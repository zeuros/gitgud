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
import type {WorkingDirectoryFileChange} from '../../lib/github-desktop/model/workdir';
import {CurrentRepoStore} from '../../stores/current-repo.store';

@Injectable({
  providedIn: 'root',
})
export class WorkingDirectoryService {

  private gitApi = inject(GitApiService);
  private gitRefresh = inject(GitRefreshService);
  private currentRepo = inject(CurrentRepoStore);

  // Runs in the worktree whose work in progress the right panel shows
  private gitAction = (args: string[]) => this.gitApi.gitAction(args, {cwd: this.currentRepo.wipWorktree()});
  private gitWithInput = (args: string[], patch: string) => this.gitApi.gitWithInput(args, patch, this.currentRepo.wipWorktree());

  stageFile = ({path}: WorkingDirectoryFileChange) => this.gitAction(['add', '--', path]).subscribe(this.gitRefresh.doUpdateWipChanges);

  stageFiles = (files: WorkingDirectoryFileChange[]) =>
    this.gitAction(['add', '--', ...files.map(f => f.path)]).subscribe(this.gitRefresh.doUpdateWipChanges);

  unstageFiles = (files: WorkingDirectoryFileChange[]) =>
    this.gitAction(['reset', '--', ...files.map(f => f.path)]).subscribe(this.gitRefresh.doUpdateWipChanges);

  /** Stage (or unstage) a patch via stdin, then refresh */
  stageChangesWithPatch = (patch: string, stage: boolean) =>
    this.gitWithInput(['apply', ...(stage ? [] : ['-R']), '--cached', '--unidiff-zero', '--allow-overlap', '-'], patch).subscribe(this.gitRefresh.doUpdateWipChanges);

  /** Revert a patch in the working directory (no --cached), discarding the change */
  discardChangesWithPatch = (patch: string) =>
    this.gitWithInput(['apply', '-R', '--unidiff-zero', '--allow-overlap', '-'], patch).subscribe(this.gitRefresh.doUpdateWipChanges);

  unstageFile = ({path}: WorkingDirectoryFileChange) => this.gitAction(['reset', '--', path]).subscribe(this.gitRefresh.doUpdateWipChanges);

  stageAll = () => this.gitAction(['add', '--all']).subscribe(this.gitRefresh.doUpdateWipChanges);

  unstageAll = () => this.gitAction(['reset', 'HEAD', '--', '.']).subscribe(this.gitRefresh.doUpdateWipChanges);

}
