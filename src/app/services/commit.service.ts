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
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {map, switchMap} from 'rxjs';
import {workingDirHasChanges} from '../utils/utils';
import {GitRefreshService} from './git-refresh.service';
import {FileDiffPanelService} from './file-diff-panel.service';

@Injectable({providedIn: 'root'})
export class CommitService {

  private gitApi = inject(GitApiService);
  private gitRefresh = inject(GitRefreshService);
  private currentRepo = inject(CurrentRepoStore);
  private fileDiffPanel = inject(FileDiffPanelService);

  commit = (summary: string, description?: string, amend = false) =>
    this.gitApi.gitAction(['commit', ...(amend ? ['--amend'] : []), '-m', summary, ...(description ? ['-m', description] : [])])
      .pipe(switchMap(this.gitRefresh.refreshAll))
      .subscribe(({workDirStatus}) => {
        this.fileDiffPanel.closeViews();
        if (!workingDirHasChanges(workDirStatus))
          this.headSha().subscribe(sha => this.currentRepo.update({selectedCommitsShas: [sha]}));
      });

  private headSha = () => this.gitApi.git(['rev-parse', 'HEAD']).pipe(map(sha => sha.trim()));
}