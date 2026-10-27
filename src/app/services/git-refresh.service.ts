/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {computed, DestroyRef, inject, Injectable, signal} from '@angular/core';
import {asyncScheduler, defer, finalize, forkJoin, from, map, type Observable, of, ReplaySubject, switchMap, tap, throttleTime} from 'rxjs';
import {LogReaderService} from './git/log-reader.service';
import {BranchReaderService} from './git/branch-reader.service';
import {StashReaderService} from './git/stash-reader.service';
import {TagReaderService} from './git/tag-reader.service';
import {WorktreeReaderService} from './git/worktree-reader.service';
import {GitApiService} from './git/git-api.service';
import {filterOutStashes} from '../utils/repository-utils';
import {gitPath} from '../utils/git-path.utils';
import {detectOperationInProgress} from '../utils/operation-in-progress.utils';
import type {GitRepository} from '../models/git-repository';
import type {GitTag} from '../models/git-tag';
import type {Commit} from '../lib/github-desktop/model/commit';
import {GitRepositoryStore} from '../stores/git-repos.store';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {FileWatcherService} from './file-watcher.service';
import {parseWorkingDirChanges} from '../lib/github-desktop/commit-files-changes';
import {FileDiffPanelService} from './file-diff-panel.service';

const DEFAULT_NUMBER_OR_COMMITS_TO_SHOW = 1200;

// .git entries whose mtime changes whenever refs/HEAD/index move (commit, checkout, fetch, branch, stash…)
const GIT_STATE_FILES = ['HEAD', 'index', 'packed-refs', 'FETCH_HEAD', 'ORIG_HEAD', 'logs/HEAD', 'refs/heads', 'refs/tags', 'refs/stash'];

@Injectable({
  providedIn: 'root',
})
export class GitRefreshService {

  private logReader = inject(LogReaderService);
  private branchReader = inject(BranchReaderService);
  private stashReader = inject(StashReaderService);
  private tagReader = inject(TagReaderService);
  private worktreeReader = inject(WorktreeReaderService);
  private gitRepositoryStore = inject(GitRepositoryStore);
  private gitApi = inject(GitApiService);
  private currentRepo = inject(CurrentRepoStore);
  private fileWatcher = inject(FileWatcherService);
  private fileDiffPanel = inject(FileDiffPanelService);
  private destroyRef = inject(DestroyRef);

  private _active = signal(0);
  isRefreshing = computed(() => this._active() > 0);

  private track = <T>(source$: Observable<T>): Observable<T> =>
    defer(() => {
      this._active.update(n => n + 1);
      return source$.pipe(finalize(() => this._active.update(n => n - 1)));
    });

  // Emits once the selected repository's first load ended (loaded or failed), right away with no repository open
  readonly appReady$ = new ReplaySubject<true>(1);

  constructor() {
    // First load of the selected repository (if any) and show main window
    (this.currentRepo.cwd() ? this.refreshAll() : of({}))
      .pipe(finalize(() => this.appReady$.next(true)))
      .subscribe();
    window.tauri.onWindowFocus(this.onWindowFocus);
    this.destroyRef.onDestroy(() => window.tauri.offWindowFocus(this.onWindowFocus));
    this.fileWatcher.onWorkingDirFileChange$.pipe(
      throttleTime(500, asyncScheduler, {leading: false, trailing: true}),
      switchMap(() => this.updateWorkingDirChanges()),
    ).subscribe();
  }

  refreshAll = () => this.track(this.leaveRemovedWorktree().pipe(switchMap(() => forkJoin({
    workDirStatus: this.updateWorkingDirChanges(),
    logsAndBranches: this.updateLogsAndBranches(), // refresh log and wait for it so that selected commit sha can be updated
    operationInProgress: this.updateOperationInProgress(),
  }))));

  // Back to the main worktree when the active worktree's folder no longer exists
  private leaveRemovedWorktree = () => {
    const worktree = this.currentRepo.activeWorktree();
    return worktree
      ? from(window.tauri.fs.exists(worktree)).pipe(tap(exists => exists || this.currentRepo.update({activeWorktree: undefined})))
      : of(true);
  };

  doRefreshAll = () => this.refreshAll().subscribe();

  private lastGitStateSignature?: string;

  // Stats a few git-dir entries; a changed signature means refs/HEAD/index moved since last check.
  // All-missing (or no git dir found) yields undefined → caller must assume changed.
  private gitStateSignature = async () => {
    const cwd = this.currentRepo.cwd();
    const dirs = await this.gitApi.gitDirs(cwd).catch(() => undefined);
    if (!dirs) return undefined;
    const mtimes = await Promise.all(GIT_STATE_FILES.map(f => window.tauri.fs.mtime(gitPath(dirs, f)).catch(() => 0)));
    return mtimes.some(Boolean) ? `${cwd}|${mtimes.join(',')}` : undefined;
  };

  // On focus, the working dir may have changed (editor), so always refresh status; only reload the
  // (expensive) logs/branches/tags when git state actually moved while we were in the background.
  private onWindowFocus = () => {
    if (!this.currentRepo.cwd()) return;
    from(this.gitStateSignature()).pipe(
      switchMap(sig => {
        const unchanged = sig !== undefined && sig === this.lastGitStateSignature;
        this.lastGitStateSignature = sig;
        return unchanged
          ? this.track(forkJoin({workDirStatus: this.updateWorkingDirChanges(), operationInProgress: this.updateOperationInProgress()}))
          : this.refreshAll();
      }),
    ).subscribe();
  };

  /**
   * Fetches logs, branches, and stashes for the current repository
   * and returns a partial repository update.
   * The log includes the remote tags already known; remote tags are read afterwards, without holding the refresh on the network.
   */
  updateLogsAndBranches = () => this.track(
    this.stashReader.getStashes()
      .pipe(
        switchMap(stashes => {
          const remoteTagsInLog = this.currentRepo.remoteTags();
          return forkJoin({
            logs: this.loadCommitLog(stashes, remoteTagsInLog),
            branches: this.branchReader.getBranches(),
            detachedHeadSha: this.branchReader.detachedHeadSha(),
            stashes: of(stashes),
            tags: this.tagReader.getTags(),
            worktrees: this.worktreeReader.getWorktrees(),
          }).pipe(tap((r: Partial<GitRepository>) => {
            this.gitRepositoryStore.updateSelectedRepository(r);
            this.updateRemoteTags(stashes, remoteTagsInLog);
          }));
        }),
      ));

  // Reloads the log when a remote tag points to a commit it didn't include
  private updateRemoteTags = (stashes: Commit[], remoteTagsInLog: GitTag[]) => this.track(
    this.tagReader.getRemoteTags().pipe(
      tap(remoteTags => this.gitRepositoryStore.updateSelectedRepository({remoteTags})),
      switchMap(remoteTags => {
        const shasInLog = new Set(remoteTagsInLog.map(t => t.sha));
        return remoteTags.every(t => shasInLog.has(t.sha))
          ? of(undefined)
          : this.loadCommitLog(stashes, remoteTags).pipe(tap(logs => this.gitRepositoryStore.updateSelectedRepository({logs})));
      }),
    )).subscribe();

  private loadCommitLog = (stashes: Commit[], remoteTags: GitTag[]) =>
    this.logReader.getCommitLog('--branches', DEFAULT_NUMBER_OR_COMMITS_TO_SHOW, 0, ['--remotes', '--tags', '--source', '--date-order', '--ignore-missing', ...stashes.map(s => s.sha), ...remoteTags.map(t => t.sha)])
      .pipe(map(logs => logs.filter(filterOutStashes(stashes))));

  doUpdateLogsAndBranches = () => this.updateLogsAndBranches().subscribe();


  updateOperationInProgress = () =>
    from(this.gitApi.gitDirs(this.currentRepo.cwd()!).then(dirs => detectOperationInProgress(dirs, window.tauri.fs.exists)))
      .pipe(tap(operationInProgress => this.currentRepo.update({operationInProgress})));


  /**
   * Get a list of files which have recorded changes in the index as compared to
   * HEAD along with the type of change.
   */
  updateWorkingDirChanges = () => this.track(
    this.gitApi.git(['--no-optional-locks', 'status', '--porcelain', '-z', '--untracked-files=all', '--'])
      .pipe(
        map(parseWorkingDirChanges),
        tap(workDirStatus => this.currentRepo.update({workDirStatus})),
        tap(this.fileDiffPanel.refreshWorkingDirView),
      ));

  /**
   * Get a list of files which have recorded changes in the index as compared to
   * HEAD along with the type of change.
   */
  doUpdateWorkingDirChanges = () => this.updateWorkingDirChanges().subscribe();
}