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
import {syncToStorage} from '../utils/store.utils';

/**
 * Global application store: repository list management.
 * Per-repository state lives in CurrentRepoStore.
 */
@Injectable({providedIn: 'root'})
export class GitRepositoryStore {

  private localStorageService = inject(LocalStorageService);

  private _repositories = signal<GitRepository[]>(this.localStorageService.get<GitRepository[]>(StorageName.GitRepositories) ?? []);

  repositories = this._repositories.asReadonly();
  selectedRepository = computed(() => this._repositories().find(r => r.selected));
  selectedIndex = computed(() => this._repositories().findIndex(r => r.selected));
  hasRepositories = computed(() => this._repositories().length > 0);

  constructor() {
    syncToStorage(this._repositories, StorageName.GitRepositories, this.localStorageService);
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
