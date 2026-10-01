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
import {fromStoredRepository, type StoredRepository, toStoredRepository} from '../utils/repository-utils';

/**
 * Global application store: repository list management.
 * Per-repository state lives in CurrentRepoStore.
 */
@Injectable({providedIn: 'root'})
export class GitRepositoryStore {

  private localStorage = inject(LocalStorageService);

  private _repositories = signal<GitRepository[]>((this.localStorage.get<StoredRepository[]>(StorageName.GitRepositories) ?? []).map(fromStoredRepository));
  private _recentIds = signal<string[]>([]);
  // Closed this session, last one at the end
  private closedRepositories: {repository: StoredRepository, index: number}[] = [];

  repositories = this._repositories.asReadonly();
  selectedRepository = computed(() => this._repositories().find(r => r.selected));
  selectedIndex = computed(() => this._repositories().findIndex(r => r.selected));
  hasRepositories = computed(() => this._repositories().length > 0);

  recentIds = this._recentIds.asReadonly();

  newTabOpen = signal(false);
  newTabSelected = signal(false);

  openNewTab = () => { this.newTabOpen.set(true); this.newTabSelected.set(true); };
  closeNewTab = () => { this.newTabOpen.set(false); this.newTabSelected.set(false); };
  activateNewTab = () => this.newTabSelected.set(true);
  deactivateNewTab = () => this.newTabSelected.set(false);

  constructor() {
    syncToStorage(this._repositories, StorageName.GitRepositories, this.localStorage, repos => repos.map(toStoredRepository));
    syncToStorage(this._recentIds, StorageName.RecentRepoIds, this.localStorage);
  }

  removeRecent = (id: string) =>
    this._recentIds.update(ids => ids.filter(i => i !== id));

  addRepository = (repository: GitRepository) => {
    this._repositories.update(repos => [...repos, repository]);
    this.touchRecent(repository.id);
  };

  selectRepository = (directoryOrIndex: string | number) => {
    this.deactivateNewTab();
    this._repositories.update(repos => repos.map((r, i) => ({...r, selected: typeof directoryOrIndex === 'number' ? i === directoryOrIndex : r.id === directoryOrIndex})));
    const id = typeof directoryOrIndex === 'number'
      ? this._repositories()[directoryOrIndex]?.id
      : directoryOrIndex;
    if (id) this.touchRecent(id);
  };

  removeRepository = (indexOrId: number | string) => {
    this._repositories.update(repos => {
      const repoToRemove = repos.findIndex((r, i) => typeof indexOrId === 'number' ? i == indexOrId : r.id == indexOrId);
      const filtered = repos.filter((_, i) => i !== repoToRemove);
      if (repos[repoToRemove]) this.closedRepositories.push({repository: toStoredRepository(repos[repoToRemove]), index: repoToRemove});

      const repoToSelect = repos[repoToRemove]?.selected && filtered.length > 0
        ? Math.min(repoToRemove, filtered.length - 1)
        : undefined;
      if (repoToSelect != null) filtered[repoToSelect].selected = true;

      return filtered;
    });
  };

  /** Puts the last closed repository back where it was, returns its id (undefined when there is none left) */
  reopenClosedRepository = () => {
    let closed = this.closedRepositories.pop();
    // Skip the ones opened again by hand since
    while (closed && this._repositories().some(r => r.id == closed!.repository.id)) closed = this.closedRepositories.pop();
    if (!closed) return undefined;

    const {repository, index} = closed;
    this._repositories.update(repos => [...repos.slice(0, index), {...fromStoredRepository(repository), selected: false}, ...repos.slice(index)]);
    return repository.id;
  };

  private touchRecent =(id: string) =>
    this._recentIds.update(ids => [id, ...ids.filter(i => i !== id)].slice(0, 7));

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
