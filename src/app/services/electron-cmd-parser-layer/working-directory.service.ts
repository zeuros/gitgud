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

import {inject, Injectable} from '@angular/core';
import {GitApiService} from './git-api.service';
import {GitRefreshService} from '../git-refresh.service';
import {WorkingDirectoryFileChange} from '../../lib/github-desktop/model/workdir';

@Injectable({
  providedIn: 'root',
})
export class WorkingDirectoryService {

  private gitApi = inject(GitApiService);
  private gitRefresh = inject(GitRefreshService);

  stageFile = ({path}: WorkingDirectoryFileChange) => this.gitApi.git(['add', '--', path]).subscribe(this.gitRefresh.doUpdateWorkingDirChanges);

  stageFiles = (files: WorkingDirectoryFileChange[]) =>
    this.gitApi.git(['add', '--', ...files.map(f => f.path)]).subscribe(this.gitRefresh.doUpdateWorkingDirChanges);

  unstageFiles = (files: WorkingDirectoryFileChange[]) =>
    this.gitApi.git(['reset', '--', ...files.map(f => f.path)]).subscribe(this.gitRefresh.doUpdateWorkingDirChanges);

  /** Stage (or unstage) a patch via stdin, then refresh */
  stageChangesWithPatch = (patch: string, stage: boolean) =>
    this.gitApi.gitWithInput(['apply', ...(stage ? [] : ['-R']), '--cached', '--unidiff-zero', '--allow-overlap', '-'], patch).subscribe(this.gitRefresh.doUpdateWorkingDirChanges);

  unstageFile = ({path}: WorkingDirectoryFileChange) => this.gitApi.git(['reset', '--', path]).subscribe(this.gitRefresh.doUpdateWorkingDirChanges);

  stageAll = () => this.gitApi.git(['add', '--all']).subscribe(this.gitRefresh.doUpdateWorkingDirChanges);

  unstageAll = () => this.gitApi.git(['reset', 'HEAD', '--', '.']).subscribe(this.gitRefresh.doUpdateWorkingDirChanges);

}
