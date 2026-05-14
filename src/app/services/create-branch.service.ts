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

import {inject, Injectable, signal} from '@angular/core';
import {finalize, switchMap, tap} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {GitRefreshService} from './git-refresh.service';
import {PopupService} from './popup.service';

@Injectable({providedIn: 'root'})
export class CreateBranchService {
  private gitApi = inject(GitApiService);
  private gitRefresh = inject(GitRefreshService);
  private popup = inject(PopupService);

  newBranchSha = signal<string | undefined>(undefined);
  name = signal('');

  createBranchAtSha = (sha: string) => this.newBranchSha.set(sha);

  cancel = () => {
    this.newBranchSha.set(undefined);
    this.name.set('');
  };

  confirm = () => {
    const name = this.name().trim();
    const sha = this.newBranchSha()!;
    this.newBranchSha.set(undefined);
    this.name.set('');
    if (!name) return;
    this.gitApi.git(['branch', name, sha])
      .pipe(
        tap(() => this.popup.success(`Branch "${name}" created`)),
        switchMap(() => this.gitApi.git(['checkout', name])),
        finalize(this.gitRefresh.doUpdateLogsAndBranches),
      )
      .subscribe();
  };
}
