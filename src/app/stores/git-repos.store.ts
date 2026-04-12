import {computed, inject, Injectable, signal} from '@angular/core';
import {GitRepository} from '../models/git-repository';
import {LocalStorageService} from '../services/local-storage.service';
import {StorageName} from '../enums/storage-name.enum';
import {DEFAULT_AUTO_FETCH_INTERVAL} from '../utils/constants';
import {keyComparison, logsComparison, shallowArrayEqual} from '../utils/utils';
import {syncToStorage} from '../utils/store.utils';
import {groupBy, isEqual, mapValues, values} from 'lodash-es';
import {normalizedBranchName} from '../utils/branch-utils';

export interface AppConfig {
  autoFetchInterval: number;
}

const DEFAULT_APP_CONFIG: AppConfig = {
  autoFetchInterval: DEFAULT_AUTO_FETCH_INTERVAL,
};

@Injectable({providedIn: 'root'})
export class GitRepositoryStore {

  private readonly localStorageService = inject(LocalStorageService);

  // State
  private readonly _config = signal<AppConfig>(this.localStorageService.get<AppConfig>(StorageName.AppConfig) ?? DEFAULT_APP_CONFIG);
  private readonly _repositories = signal<GitRepository[]>(this.localStorageService.get<GitRepository[]>(StorageName.GitRepositories) ?? []);

  // App config
  readonly config = this._config.asReadonly();
  readonly updateAppConfig = (updates: Partial<AppConfig>) => this._config.update(c => ({...c, ...updates}));

  // Repositories
  readonly repositories = this._repositories.asReadonly();
  readonly selectedRepository = computed(() => this._repositories().find(r => r.selected));
  readonly selectedIndex = computed(() => this._repositories().findIndex(r => r.selected));
  readonly hasRepositories = computed(() => this._repositories().length > 0);

  // Selected repo
  readonly logs = computed(() => this.selectedRepository()?.logs ?? [], {equal: logsComparison});
  readonly stashes = computed(() => this.selectedRepository()?.stashes ?? [], {equal: logsComparison});
  readonly branches = computed(() => this.selectedRepository()?.branches ?? [], {equal: isEqual});
  readonly branchesByTip = computed(() => groupBy(this.branches(), b => b.tip.sha), {equal: keyComparison});
  // Group branches by commit SHA, then merge local/remote branches by normalized name
  readonly mergedBranchesByTip = computed(() => mapValues(this.branchesByTip(), branchesAtSha => values(groupBy(branchesAtSha, normalizedBranchName))));

  readonly startCommit = computed(() => this.selectedRepository()?.startCommit ?? 0);
  readonly workDirStatus = computed(() => this.selectedRepository()?.workDirStatus, {equal: isEqual});
  readonly panelSizes = computed(() => this.selectedRepository()?.panelSizes);
  readonly editorConfig = computed(() => this.selectedRepository()?.editorConfig);

  readonly selectedCommitsShas = computed(() => this.selectedRepository()?.selectedCommitsShas, {equal: shallowArrayEqual});
  readonly selectedCommits = computed(() => {const scs = this.selectedCommitsShas();return this.logs().filter(l => scs?.includes(l.sha));});
  readonly selectedCommitSha = computed(() => {const sc = this.selectedRepository()?.selectedCommitsShas;return sc?.length === 1 ? sc[0] : undefined;});
  readonly selectedCommit = computed(() => {const sc = this.selectedCommitSha();return this.logs().find(c => c.sha === sc);});
  readonly selectedCommitIndex = computed(() => {const sc = this.selectedCommitSha();return this.logs().findIndex(c => c.sha === sc);});
  readonly selectedStash = computed(() => {const sc = this.selectedCommitSha();return this.stashes().find(s => s.parentSHAs?.[1] && s.parentSHAs?.[1] === sc);});
  readonly headBranch = computed(() => this.branches().find(b => b.isHeadPointed));
  readonly detachedHeadSha = computed(() => this.selectedRepository()?.detachedHeadSha);

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