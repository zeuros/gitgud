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
import {defer, finalize, forkJoin, map, of, switchMap, tap} from 'rxjs';
import {Observable} from 'rxjs';
import {LogReaderService} from './electron-cmd-parser-layer/log-reader.service';
import {BranchReaderService} from './electron-cmd-parser-layer/branch-reader.service';
import {StashReaderService} from './electron-cmd-parser-layer/stash-reader.service';
import {TagReaderService} from './electron-cmd-parser-layer/tag-reader.service';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {filterOutStashes} from '../utils/repository-utils';
import {GitRepository} from '../models/git-repository';
import {GitRepositoryStore} from '../stores/git-repos.store';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {FileWatcherService} from './file-watcher.service';
import {parseWorkingDirChanges} from '../lib/github-desktop/commit-files-changes';

const DEFAULT_NUMBER_OR_COMMITS_TO_SHOW = 1200;

@Injectable({
  providedIn: 'root',
})
export class GitRefreshService {

  private logReader = inject(LogReaderService);
  private branchReader = inject(BranchReaderService);
  private stashReader = inject(StashReaderService);
  private tagReader = inject(TagReaderService);
  private gitRepositoryStore = inject(GitRepositoryStore);
  private gitApi = inject(GitApiService);
  private currentRepo = inject(CurrentRepoStore);
  private fileWatcher = inject(FileWatcherService);
  private destroyRef = inject(DestroyRef);

  private _active = signal(0);
  isRefreshing = computed(() => this._active() > 0);

  private track = <T>(source$: Observable<T>): Observable<T> =>
    defer(() => {
      this._active.update(n => n + 1);
      return source$.pipe(finalize(() => this._active.update(n => n - 1)));
    });

  constructor() {
    this.doUpdateWorkingDirChanges();
    window.electron.onWindowFocus(this.doRefreshAll);
    this.destroyRef.onDestroy(() => window.electron.offWindowFocus(this.doRefreshAll));
    this.fileWatcher.onWorkingDirFileChange$.subscribe(this.doUpdateWorkingDirChanges);
  }

  refreshAll = () => this.track(forkJoin({
    workDirStatus: this.updateWorkingDirChanges(),
    logsAndBranches: this.updateLogsAndBranches(), // refresh log and wait for it so that selected commit sha can be updated
  }));

  doRefreshAll = () => this.refreshAll().subscribe();

  /**
   * Fetches logs, branches, and stashes for the current repository
   * and returns a partial repository update.
   */
  updateLogsAndBranches = () => this.track(
    this.stashReader.getStashes()
      .pipe(
        switchMap(stashes => forkJoin({
          logs: this.logReader.getCommitLog('--branches', DEFAULT_NUMBER_OR_COMMITS_TO_SHOW, 0, ['--remotes', '--tags', '--source', '--date-order', ...stashes.map(s => s.sha)])
            .pipe(map(logs => logs.filter(filterOutStashes(stashes)))),
          branches: this.branchReader.getBranches(),
          detachedHeadSha: this.branchReader.detachedHeadSha(),
          stashes: of(stashes),
          tags: this.tagReader.getTags(),
        })),
        tap((r: Partial<GitRepository>) => this.gitRepositoryStore.updateSelectedRepository(r)),
      ));

  doUpdateLogsAndBranches = () => this.updateLogsAndBranches().subscribe();


  /**
   * Get a list of files which have recorded changes in the index as compared to
   * HEAD along with the type of change.
   */
  updateWorkingDirChanges = () => this.track(
    this.gitApi.git(['status', '--porcelain', '-z', '--'])
      .pipe(
        map(parseWorkingDirChanges),
        tap(workDirStatus => this.currentRepo.update({workDirStatus})),
      ));

  /**
   * Get a list of files which have recorded changes in the index as compared to
   * HEAD along with the type of change.
   */
  doUpdateWorkingDirChanges = () => this.updateWorkingDirChanges().subscribe();
}