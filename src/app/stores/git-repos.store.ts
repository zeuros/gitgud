import {computed, inject, Injectable, signal} from '@angular/core';
import {GitRepository} from '../models/git-repository';
import {LocalStorageService} from '../services/local-storage.service';
import {StorageName} from '../enums/storage-name.enum';
import {DEFAULT_AUTO_FETCH_INTERVAL} from '../utils/constants';
import {branchesComparison, logsComparison} from '../utils/utils';
import {syncToStorage} from '../utils/store.utils';

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

  // Selected repo
  readonly logs = computed(() => this.selectedRepository()?.logs ?? [], {equal: logsComparison});
  readonly stashes = computed(() => this.selectedRepository()?.stashes ?? []);
  readonly branches = computed(() => this.selectedRepository()?.branches ?? [], {equal: branchesComparison});
  readonly startCommit = computed(() => this.selectedRepository()?.startCommit ?? 0);
  readonly workDirStatus = computed(() => this.selectedRepository()?.workDirStatus);
  readonly panelSizes = computed(() => this.selectedRepository()?.panelSizes);
  readonly editorConfig = computed(() => this.selectedRepository()?.editorConfig);

  readonly selectedCommitsShas = computed(() => this.selectedRepository()?.selectedCommitsShas);
  readonly selectedCommitSha = computed(() => {const sc = this.selectedCommitsShas();return sc?.length === 1 ? sc[0] : undefined;});
  readonly selectedCommits = computed(() => {const sc = this.selectedCommitsShas();return this.logs().find(c => sc?.includes(c.sha));});
  readonly selectedCommit = computed(() => {const sc = this.selectedCommitSha();return this.logs().find(c => c.sha === sc);});

  constructor() {
    syncToStorage(this._repositories, StorageName.GitRepositories, this.localStorageService);
    syncToStorage(this._config, StorageName.AppConfig, this.localStorageService);
  }

  addRepository = (repository: GitRepository) =>
    this._repositories.update(repos => [...repos, repository]);

  selectRepository = (directory: string) =>
    this._repositories.update(repos => repos.map(r => ({...r, selected: r.id === directory})),);

  setCurrentRepoIndex = (index: number) =>
    this._repositories.update(repos => repos.map((r, i) => ({...r, selected: i === index})),);

  removeRepository = (indexOrId: number | string) =>
    this._repositories.update(repos => repos.filter((r, i) => typeof indexOrId === 'number' ? i !== indexOrId : r.id !== indexOrId),);

  updateSelectedRepository = (updates: Partial<GitRepository>) =>
    this._repositories.update(repos => repos.map(r => r.selected ? {...r, ...updates} : r),);
}