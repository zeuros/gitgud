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

import {DestroyRef, inject, Injectable} from '@angular/core';
import {map, tap} from 'rxjs';
import {parseWorkingDirChanges} from '../../lib/github-desktop/commit-files-changes';
import {FileWatcherService} from '../file-watcher.service';
import {GitApiService} from './git-api.service';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {WorkingDirectoryFileChange} from '../../lib/github-desktop/model/workdir';

@Injectable({
  providedIn: 'root',
})
export class WorkingDirectoryService {


  private currentRepo = inject(CurrentRepoStore);
  private gitApi = inject(GitApiService);
  private fileWatcher = inject(FileWatcherService);
  private destroyRef = inject(DestroyRef);

  constructor() {
    // Refresh working directory changes on app startup, window focus, or file system changes
    this.doFetchWorkingDirChanges();

    window.electron.onWindowFocus(this.doFetchWorkingDirChanges);
    this.destroyRef.onDestroy(() => window.electron.offWindowFocus(this.doFetchWorkingDirChanges));

    this.fileWatcher.onWorkingDirFileChange$.subscribe(this.doFetchWorkingDirChanges);
  }

  stageFile = ({path}: WorkingDirectoryFileChange) => this.gitApi.git(['add', '--', path]).subscribe(this.doFetchWorkingDirChanges);

  stageFiles = (files: WorkingDirectoryFileChange[]) =>
    this.gitApi.git(['add', '--', ...files.map(f => f.path)]).subscribe(this.doFetchWorkingDirChanges);

  unstageFiles = (files: WorkingDirectoryFileChange[]) =>
    this.gitApi.git(['reset', '--', ...files.map(f => f.path)]).subscribe(this.doFetchWorkingDirChanges);

  /** Stage (or unstage) a patch via stdin, then refresh */
  stageChangesWithPatch = (patch: string, stage: boolean) =>
    this.gitApi.gitWithInput(['apply', ...(stage ? [] : ['-R']), '--cached', '--unidiff-zero', '--allow-overlap', '-'], patch).subscribe(this.doFetchWorkingDirChanges);

  unstageFile = ({path}: WorkingDirectoryFileChange) => this.gitApi.git(['reset', '--', path]).subscribe(this.doFetchWorkingDirChanges);

  stageAll = () => this.gitApi.git(['add', '--all']).subscribe(this.doFetchWorkingDirChanges);
  unstageAll = () => this.gitApi.git(['reset', 'HEAD', '--', '.']).subscribe(this.doFetchWorkingDirChanges);

  /**
   * Get a list of files which have recorded changes in the index as compared to
   * HEAD along with the type of change.
   */
  fetchWorkingDirChanges = () =>
    this.gitApi.git([
      'status',
      '--porcelain',
      '-z',
      '--',
    ])
      .pipe(
        map(parseWorkingDirChanges),
        tap(workDirStatus => this.currentRepo.update({workDirStatus})),
      );

  /**
   * Get a list of files which have recorded changes in the index as compared to
   * HEAD along with the type of change.
   */
  doFetchWorkingDirChanges = () => this.fetchWorkingDirChanges().subscribe();

}

