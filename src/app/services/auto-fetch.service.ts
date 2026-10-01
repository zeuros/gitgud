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

import {DestroyRef, effect, inject, Injectable, signal, untracked} from '@angular/core';
import {finalize} from 'rxjs';
import {GitRepositoryStore} from '../stores/git-repos.store';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {GitRefreshService} from './git-refresh.service';
import {SettingsService} from './settings.service';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {errorMessage} from '../utils/utils';

// How often to check whether a fetch is due. A plain setInterval(fetch, interval) drifts: WebKit throttles timers of
// hidden windows, and it ignores manual fetches. Checking often against the last fetch time (and on focus) doesn't
const DUE_CHECK_INTERVAL_MS = 15_000;

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
  lastFetchError = signal<string | undefined>(undefined);

  private fetching = false;
  private lastAttemptAt = 0; // a failed fetch is retried after a full interval, not on every check

  constructor() {
    const intervalId = setInterval(this.fetchIfDue, DUE_CHECK_INTERVAL_MS);
    window.tauri.onWindowFocus(this.fetchIfDue);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(intervalId);
      window.tauri.offWindowFocus(this.fetchIfDue);
    });

    // Initialize last-fetched time from .git/FETCH_HEAD mtime when repo changes
    effect(() => {
      const cwd = this.currentRepo.cwd();
      if (!cwd) return;
      const fetchHead = `${cwd}/.git/FETCH_HEAD`;
      window.tauri.fs.exists(fetchHead).then(exists =>
        exists
          ? window.tauri.fs.mtime(fetchHead).then(ms => untracked(() => this.lastFetchedAt.set(ms)))
          : untracked(() => this.lastFetchedAt.set(undefined)),
      );
    });
  }

  // After any successful fetch (auto or manual)
  markFetched = () => {
    this.lastFetchedAt.set(Date.now());
    this.lastFetchError.set(undefined);
  };

  private fetchIfDue = () => {
    if (this.fetching || !untracked(() => this.gitRepositoryStore.selectedRepository())) return;
    const lastFetch = Math.max(untracked(this.lastFetchedAt) ?? 0, this.lastAttemptAt);
    if (Date.now() - lastFetch < this.settings.autoFetchInterval) return;

    this.fetching = true;
    this.lastAttemptAt = Date.now();
    this.gitApi.git(['fetch', '--prune'])
      .pipe(finalize(() => this.fetching = false))
      .subscribe({
        next: () => {
          this.markFetched();
          this.gitRefresh.doUpdateLogsAndBranches();
        },
        error: e => {
          console.warn('Auto-fetch failed', e);
          this.lastFetchError.set(errorMessage(e));
        },
      });
  };

}
