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
import {GitApiService} from './git/git-api.service';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {map, switchMap, tap} from 'rxjs';
import {workingDirHasChanges} from '../utils/utils';
import {GitRefreshService} from './git-refresh.service';
import {FileDiffPanelService} from './file-diff-panel.service';

@Injectable({providedIn: 'root'})
export class CommitService {

  private gitApi = inject(GitApiService);
  private gitRefresh = inject(GitRefreshService);
  private currentRepo = inject(CurrentRepoStore);
  private fileDiffPanel = inject(FileDiffPanelService);

  // Commits in the worktree whose work in progress the right panel shows, then selects the new commit once that worktree is clean
  commit = (summary: string, description?: string, amend = false) => {
    const worktreePath = this.currentRepo.wipWorktree();
    return this.gitApi.gitAction(['commit', ...(amend ? ['--amend'] : []), '-m', summary, ...(description ? ['-m', description] : [])], {cwd: worktreePath})
      .pipe(
        switchMap(this.gitRefresh.refreshAll),
        tap(() => {
          this.fileDiffPanel.closeViews();
          if (!workingDirHasChanges(this.currentRepo.wipStatus()))
            this.headSha(worktreePath).subscribe(sha => this.currentRepo.update({selectedCommitsShas: [sha]}));
        }),
      );
  };

  private headSha = (worktreePath?: string) => this.gitApi.git(['rev-parse', 'HEAD'], {cwd: worktreePath}).pipe(map(sha => sha.trim()));
}