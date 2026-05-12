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

import {effect, inject, Injectable, signal, untracked} from '@angular/core';
import {GitRepositoryStore} from '../stores/git-repos.store';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {GitRefreshService} from './git-refresh.service';
import {SettingsService} from './settings.service';
import {CurrentRepoStore} from '../stores/current-repo.store';

@Injectable({
  providedIn: 'root',
})
export class AutoFetchService {

  private gitRefresh = inject(GitRefreshService);
  private currentRepo = inject(CurrentRepoStore);
  private gitApi = inject(GitApiService);
  private gitRepositoryStore = inject(GitRepositoryStore);
  private settings = inject(SettingsService);

  lastFetchedAt = signal<number | undefined>(undefined);

  private intervalId?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(this.autoFetch, this.settings.autoFetchInterval);
    });

    // Initialize last-fetched time from .git/FETCH_HEAD mtime when repo changes
    effect(() => {
      const cwd = this.currentRepo.cwd();
      if (!cwd) return;
      const fetchHead = `${cwd}/.git/FETCH_HEAD`;
      untracked(() => this.lastFetchedAt.set(
        window.electron.fs.existsSync(fetchHead) ? window.electron.fs.mtimeMs(fetchHead) : undefined,
      ));
    });
  }

  private autoFetch = () => {
    if (untracked(() => this.gitRepositoryStore.selectedRepository())) {
      this.gitApi.git(['fetch']).subscribe(() => {
        this.lastFetchedAt.set(Date.now());
        this.gitRefresh.doUpdateLogsAndBranches();
      });
    }
  };

}
