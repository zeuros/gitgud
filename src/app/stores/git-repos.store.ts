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

import {computed, inject, Injectable, signal} from '@angular/core';
import {GitRepository} from '../models/git-repository';
import {LocalStorageService} from '../services/local-storage.service';
import {StorageName} from '../enums/storage-name.enum';
import {DEFAULT_AUTO_FETCH_INTERVAL} from '../utils/constants';
import {syncToStorage} from '../utils/store.utils';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface AppConfig {
  autoFetchInterval: number;
  theme?: ThemeMode;
  gitBinaryPath?: string;
}

const DEFAULT_APP_CONFIG: AppConfig = {
  autoFetchInterval: DEFAULT_AUTO_FETCH_INTERVAL,
};

/**
 * Global application store: repository list management and app config.
 * Per-repository state lives in CurrentRepoStore.
 */
@Injectable({providedIn: 'root'})
export class GitRepositoryStore {

  private readonly localStorageService = inject(LocalStorageService);

  // State
  private readonly _config = signal<AppConfig>(this.localStorageService.get<AppConfig>(StorageName.AppConfig) ?? DEFAULT_APP_CONFIG);
  private readonly _repositories = signal<GitRepository[]>(this.localStorageService.get<GitRepository[]>(StorageName.GitRepositories) ?? []);

  // App config
  readonly config = this._config.asReadonly();
  readonly updateAppConfig = (updates: Partial<AppConfig>) => this._config.update(c => ({...c, ...updates}));

  // Repositories list
  readonly repositories = this._repositories.asReadonly();
  readonly selectedRepository = computed(() => this._repositories().find(r => r.selected));
  readonly selectedIndex = computed(() => this._repositories().findIndex(r => r.selected));
  readonly hasRepositories = computed(() => this._repositories().length > 0);

  constructor() {
    syncToStorage(this._repositories, StorageName.GitRepositories, this.localStorageService);
    syncToStorage(this._config, StorageName.AppConfig, this.localStorageService);
  }

  addRepository = (repository: GitRepository) =>
    this._repositories.update(repos => [...repos, repository]);

  selectRepository = (directoryOrIndex: string | number) =>
    this._repositories.update(repos => repos.map((r, i) => ({...r, selected: typeof directoryOrIndex === 'number' ? i === directoryOrIndex : r.id === directoryOrIndex})));

  removeRepository = (indexOrId: number | string) =>
    this._repositories.update(repos => repos.filter((r, i) => typeof indexOrId === 'number' ? i !== indexOrId : r.id !== indexOrId));

  updateSelectedRepository = (updates: Partial<GitRepository>) =>
    this._repositories.update(repos => repos.map(r => r.selected ? {...r, ...updates} : r));

  reorderRepositories = (from: number, to: number) => {
    this._repositories.update(repos => {
      const result = [...repos];
      result.splice(to, 0, result.splice(from, 1)[0]);
      return result;
    });
  };
}
