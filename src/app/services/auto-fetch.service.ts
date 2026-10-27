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

import {effect, inject, Injectable, signal} from '@angular/core';
import {GitApiService} from './git/git-api.service';
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
  private settings = inject(SettingsService);

  lastFetchedAt = signal<number | undefined>(undefined);

  constructor() {
    // Restarts when the delay changes
    effect(onCleanup => {
      this.lastFetchedAt();
      const intervalId = setInterval(this.fetch, this.settings.autoFetchIntervalMs());
      onCleanup(() => clearInterval(intervalId));
    });

    // The last fetch of the opened repo, if any
    effect(() => {
      const cwd = this.currentRepo.cwd();
      if (!cwd) return;

      this.gitApi.gitPath('FETCH_HEAD', cwd).then(window.tauri.fs.mtime)
        .then(lastFetchedAt => {
          this.lastFetchedAt.set(lastFetchedAt);
          // Fetches if fetchInterval is overdue on repo switch
          if (Date.now() - lastFetchedAt > this.settings.autoFetchIntervalMs()) this.fetch();
        }, () => this.lastFetchedAt.set(undefined));
    });
  }


  private fetch = () => this.currentRepo.cwd() && this.gitApi.git(['fetch', '--prune']).subscribe({
    next: () => {
      this.lastFetchedAt.set(Date.now());
      this.gitRefresh.doUpdateLogsAndBranches();
    },
    error: error => console.warn('Auto-fetch failed', error),
  });

}
