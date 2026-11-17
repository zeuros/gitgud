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
import {catchError, concatMap, defer, EMPTY, finalize, forkJoin, from, map, type Observable, of, ReplaySubject, switchMap, tap} from 'rxjs';
import {LogReaderService} from './git/log-reader.service';
import {BranchReaderService} from './git/branch-reader.service';
import {StashReaderService} from './git/stash-reader.service';
import {TagReaderService} from './git/tag-reader.service';
import {WorktreeReaderService} from './git/worktree-reader.service';
import {GitApiService} from './git/git-api.service';
import {filterOutStashes} from '../utils/repository-utils';
import {notUndefined} from '../utils/utils';
import {detectOperationInProgress} from '../utils/operation-in-progress.utils';
import type {GitRepository} from '../models/git-repository';
import type {GitTag} from '../models/git-tag';
import type {Commit} from '../lib/github-desktop/model/commit';
import {GitRepositoryStore} from '../stores/git-repos.store';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {FileWatcherService} from './file-watcher.service';
import {parseWorkingDirChanges} from '../lib/github-desktop/commit-files-changes';
import {FileDiffPanelService} from './file-diff-panel.service';
import {ToastService} from './toast.service';

const DEFAULT_NUMBER_OR_COMMITS_TO_SHOW = 1200;
// A worktree's index: staging rewrites it, which only changes the status
const isIndex = (path: string) => path.endsWith('/index') && !path.includes('/refs/');


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
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  private _active = signal(0);
  isRefreshing = computed(() => this._active() > 0);

  private track = <T>(source$: Observable<T>): Observable<T> =>
    defer(() => {
      this._active.update(n => n + 1);
      return source$.pipe(finalize(() => this._active.update(n => n - 1)));
    });

  // Runs a load with a function saving its results into the repository selected when it started: the user may switch tabs before git answers
  private forSelectedRepository = <T>(load: (save: (updates: Partial<GitRepository>) => void) => Observable<T>) => defer(() => {
    const repoId = this.currentRepo.id();
    return load(updates => repoId && this.gitRepositoryStore.updateRepository(repoId, updates));
  });

  // Emits once the selected repository's first load ended (loaded or failed), right away with no repository open
  readonly appReady$ = new ReplaySubject<true>(1);

  constructor() {
    // First load of the selected repository (if any) and show main window
    this.refreshAll()
      .pipe(finalize(() => this.appReady$.next(true)))
      .subscribe();
    window.tauri.onWindowFocus(this.onWindowFocus);
    this.destroyRef.onDestroy(() => window.tauri.offWindowFocus(this.onWindowFocus));
    // Each batch's refresh completes: logLoadedAt is set when a load starts, it must not be cancelled
    this.fileWatcher.onGitStateChange$.pipe(
      concatMap(paths => from(this.changedSinceLogLoad(paths.filter(path => !isIndex(path)))).pipe(
        concatMap(changed => changed ? this.refreshAll() : this.updateChangedIndexes(paths.filter(isIndex))),
      )),
    ).subscribe();
    // A worktree folder deleted (or moved): refreshAll closes its tab, or leaves the removed linked worktree
    this.fileWatcher.onWorkingDirFileChange$.pipe(
      switchMap(() => from(window.tauri.fs.exists(this.currentRepo.cwd()!))),
      switchMap(exists => exists ? this.updateWorkingDirChanges() : this.refreshAll()),
    ).subscribe();
    // One status per worktree changed, a new batch cancelling the statuses still running
    this.fileWatcher.onOtherWorktreeFileChange$.pipe(
      switchMap(worktreePaths => forkJoin(worktreePaths.map(this.updateWorktreeChanges))),
    ).subscribe();
  }

  // Refreshes the status of the worktrees whose index changed (staging elsewhere)
  private updateChangedIndexes = (indexPaths: string[]) => {
    if (!indexPaths.length) return EMPTY;
    const cwd = this.currentRepo.cwd();
    const worktreePaths = [cwd, ...this.currentRepo.otherWorktrees().map(w => w.path)].filter(notUndefined);
    return from(Promise.all(worktreePaths.map(path => this.gitApi.gitDirs(path).then(dirs => dirs.gitDir, () => undefined)))).pipe(
      // An index no worktree is known for: the worktree list is outdated, the tab's worktree is refreshed as before
      map(gitDirs => worktreePaths.filter((_path, i) => indexPaths.includes(`${gitDirs[i]}/index`))),
      concatMap(changedWorktreePaths => changedWorktreePaths.length
        ? forkJoin(changedWorktreePaths.map(path => path === cwd ? this.updateWorkingDirChanges() : this.updateWorktreeChanges(path)))
        : this.updateWorkingDirChanges()),
    );
  };

  refreshAll = () => this.track(this.closeRemovedRepositoryAndSelectNextOne()
    .pipe(switchMap(() => forkJoin({
      workDirStatus: this.updateWorkingDirChanges(),
      logsAndBranches: this.updateLogsAndBranches(), // refresh log and wait for it so that selected commit sha can be updated
      operationInProgress: this.updateOperationInProgress(),
    })),
    switchMap(results => this.updateOtherWorktreesChanges().pipe(map(() => results)))));

  // Closes the tab when its repository folder no longer exists, the next one being selected, and leaves a removed worktree;
  // completes without emitting when no tab is left open
  private closeRemovedRepositoryAndSelectNextOne = () => {
    const repoId = this.currentRepo.id();
    if (!repoId) return EMPTY;
    return from(window.tauri.fs.exists(repoId)).pipe(
      tap(exists => {
        if (exists) return;
        this.gitRepositoryStore.removeRepository(repoId);
        this.toast.warn(`${repoId} was removed from the disk and closed`);
      }),
      switchMap(() => this.currentRepo.cwd() ? this.leaveRemovedWorktree() : EMPTY),
    );
  };

  // Back to the main worktree when the active worktree's folder no longer exists
  private leaveRemovedWorktree = () => {
    const worktree = this.currentRepo.activeWorktree();
    return worktree
      ? from(window.tauri.fs.exists(worktree)).pipe(tap(exists => exists || this.currentRepo.update({activeWorktree: undefined})))
      : of(true);
  };

  doRefreshAll = () => this.refreshAll().subscribe();

  // When the log started loading: older writes were the app's own, newer ones may be missing from it
  private logLoadedAt = 0;

  // A path written since the log started loading, or deleted (a branch removed)
  private changedSinceLogLoad = (paths: string[]) =>
    Promise.all(paths.map(path => window.tauri.fs.mtime(path).then(mtime => mtime > this.logLoadedAt, () => true)))
      .then(changed => changed.some(Boolean));

  private refreshStatus = () => this.track(forkJoin({
    workDirStatus: this.updateWorkingDirChanges(),
    otherWorktrees: this.updateOtherWorktreesChanges(),
    operationInProgress: this.updateOperationInProgress(),
  }));

  // An editor may have changed files while in the background; git commands run elsewhere are seen by the git state watcher
  private onWindowFocus = () => {
    if (this.currentRepo.cwd()) this.refreshStatus().subscribe();
  };

  /**
   * Fetches logs, branches, and stashes for the current repository
   * and returns a partial repository update.
   * The log includes the remote tags already known; remote tags are read afterwards, without holding the refresh on the network.
   */
  updateLogsAndBranches = () => this.track(this.forSelectedRepository(save => {
    this.logLoadedAt = Date.now();
    return this.stashReader.getStashes()
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
            save(r);
            this.updateRemoteTags(stashes, remoteTagsInLog, save);
          }));
        }),
      );
  }));

  // Reloads the log when a remote tag points to a commit it didn't include
  private updateRemoteTags = (stashes: Commit[], remoteTagsInLog: GitTag[], save: (updates: Partial<GitRepository>) => void) => this.track(
    this.tagReader.getRemoteTags().pipe(
      tap(remoteTags => save({remoteTags})),
      switchMap(remoteTags => {
        const shasInLog = new Set(remoteTagsInLog.map(t => t.sha));
        return remoteTags.every(t => shasInLog.has(t.sha))
          ? of(undefined)
          : this.loadCommitLog(stashes, remoteTags).pipe(tap(logs => save({logs})));
      }),
    )).subscribe();

  private loadCommitLog = (stashes: Commit[], remoteTags: GitTag[]) =>
    this.logReader.getCommitLog('--branches', DEFAULT_NUMBER_OR_COMMITS_TO_SHOW, 0, ['--remotes', '--tags', '--source', '--date-order', '--ignore-missing', ...stashes.map(s => s.sha), ...remoteTags.map(t => t.sha)])
      .pipe(map(logs => logs.filter(filterOutStashes(stashes))));

  doUpdateLogsAndBranches = () => this.updateLogsAndBranches().subscribe();


  updateOperationInProgress = () => this.forSelectedRepository(save =>
    from(this.gitApi.gitDirs(this.currentRepo.cwd()!).then(dirs => detectOperationInProgress(dirs, window.tauri.fs.exists)))
      .pipe(tap(operationInProgress => save({operationInProgress}))));


  private readWorkDirStatus = (worktreePath?: string) =>
    this.gitApi.git(['--no-optional-locks', 'status', '--porcelain', '-z', '--untracked-files=all', '--'], {cwd: worktreePath ?? this.currentRepo.cwd()})
      .pipe(map(parseWorkingDirChanges));

  /**
   * Get a list of files which have recorded changes in the index as compared to
   * HEAD along with the type of change.
   */
  updateWorkingDirChanges = () => this.track(this.forSelectedRepository(save =>
    this.readWorkDirStatus()
      .pipe(
        tap(workDirStatus => save({workDirStatus})),
        tap(() => this.currentRepo.wipWorktree() === this.currentRepo.cwd() && this.fileDiffPanel.refreshWorkingDirView()),
      )));

  // The work in progress of another worktree; the worktree the tab works in uses updateWorkingDirChanges
  updateWorktreeChanges = (worktreePath: string) => this.track(this.forSelectedRepository(save =>
    this.readWorkDirStatus(worktreePath).pipe(
      tap(workDirStatus => save({worktreeStatuses: {...this.currentRepo.worktreeStatuses(), [worktreePath]: workDirStatus}})),
      tap(() => this.currentRepo.wipWorktree() === worktreePath && this.fileDiffPanel.refreshWorkingDirView()),
    )));

  // Reads every other worktree's work in progress, forgetting removed worktrees'
  updateOtherWorktreesChanges = () => this.track(this.forSelectedRepository(save => {
    const worktreePaths = this.currentRepo.otherWorktrees().map(w => w.path);
    if (!worktreePaths.length) {
      save({worktreeStatuses: {}});
      return of({});
    }
    return forkJoin(worktreePaths.map(path => this.readWorkDirStatus(path).pipe(catchError(() => of(undefined))))).pipe(
      map(statuses => Object.fromEntries(worktreePaths.flatMap((path, i) => statuses[i] ? [[path, statuses[i]]] : []))),
      tap(worktreeStatuses => save({worktreeStatuses})),
      tap(() => this.currentRepo.wipWorktree() !== this.currentRepo.cwd() && this.fileDiffPanel.refreshWorkingDirView()),
    );
  }));

  /**
   * Get a list of files which have recorded changes in the index as compared to
   * HEAD along with the type of change.
   */
  doUpdateWorkingDirChanges = () => this.updateWorkingDirChanges().subscribe();
}