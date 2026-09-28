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
import {defer, finalize, forkJoin, from, map, Observable, of, switchMap, tap, throttleTime, asyncScheduler} from 'rxjs';
import {LogReaderService} from './electron-cmd-parser-layer/log-reader.service';
import {BranchReaderService} from './electron-cmd-parser-layer/branch-reader.service';
import {StashReaderService} from './electron-cmd-parser-layer/stash-reader.service';
import {TagReaderService} from './electron-cmd-parser-layer/tag-reader.service';
import {WorktreeReaderService} from './electron-cmd-parser-layer/worktree-reader.service';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {filterOutStashes} from '../utils/repository-utils';
import {GitRepository} from '../models/git-repository';
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

  constructor() {
    if (this.currentRepo.cwd()) this.doRefreshAll();
    window.tauri.onWindowFocus(this.onWindowFocus);
    this.destroyRef.onDestroy(() => window.tauri.offWindowFocus(this.onWindowFocus));
    this.fileWatcher.onWorkingDirFileChange$.pipe(
      throttleTime(500, asyncScheduler, {leading: false, trailing: true}),
      switchMap(() => this.updateWorkingDirChanges()),
    ).subscribe();
  }

  refreshAll = () => this.track(forkJoin({
    workDirStatus: this.updateWorkingDirChanges(),
    logsAndBranches: this.updateLogsAndBranches(), // refresh log and wait for it so that selected commit sha can be updated
    isRebasing: this.updateRebaseStatus(),
  }));

  doRefreshAll = () => this.refreshAll().subscribe();

  private lastGitStateSignature?: string;

  // Stats a few .git entries; a changed signature means refs/HEAD/index moved since last check.
  // All-missing (e.g. worktree where .git is a file) yields undefined → caller must assume changed.
  private gitStateSignature = async () => {
    const cwd = this.currentRepo.cwd();
    const mtimes = await Promise.all(GIT_STATE_FILES.map(f => window.tauri.fs.mtime(`${cwd}/.git/${f}`).catch(() => 0)));
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
          ? this.track(forkJoin({workDirStatus: this.updateWorkingDirChanges(), isRebasing: this.updateRebaseStatus()}))
          : this.refreshAll();
      }),
    ).subscribe();
  };

  /**
   * Fetches logs, branches, and stashes for the current repository
   * and returns a partial repository update.
   */
  updateLogsAndBranches = () => this.track(
    forkJoin({stashes: this.stashReader.getStashes(), remoteTags: this.tagReader.getRemoteTags()})
      .pipe(
        switchMap(({stashes, remoteTags}) => forkJoin({
          logs: this.logReader.getCommitLog('--branches', DEFAULT_NUMBER_OR_COMMITS_TO_SHOW, 0, ['--remotes', '--tags', '--source', '--date-order', '--ignore-missing', ...stashes.map(s => s.sha), ...remoteTags.map(t => t.sha)])
            .pipe(map(logs => logs.filter(filterOutStashes(stashes)))),
          branches: this.branchReader.getBranches(),
          detachedHeadSha: this.branchReader.detachedHeadSha(),
          stashes: of(stashes),
          tags: this.tagReader.getTags(),
          remoteTags: of(remoteTags),
          worktrees: this.worktreeReader.getWorktrees(),
        })),
        tap((r: Partial<GitRepository>) => this.gitRepositoryStore.updateSelectedRepository(r)),
      ));

  doUpdateLogsAndBranches = () => this.updateLogsAndBranches().subscribe();



  updateRebaseStatus = () =>
    from(window.tauri.fs.exists(`${this.currentRepo.cwd()}/.git/rebase-merge`))
      .pipe(tap(isRebasing => this.currentRepo.update({isRebasing})));

  doUpdateRebaseStatus = () => this.updateRebaseStatus().subscribe();


  /**
   * Get a list of files which have recorded changes in the index as compared to
   * HEAD along with the type of change.
   */
  updateWorkingDirChanges = () => this.track(
    // --no-optional-locks: don't opportunistically rewrite .git/index (lock contention with the
    // user's own git, and it would bump the index mtime used by the focus-refresh signature)
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