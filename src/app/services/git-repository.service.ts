import {inject, Injectable} from '@angular/core';
import {BehaviorSubject, debounceTime, forkJoin, map, Observable, of, Subject, switchMap, tap} from 'rxjs';
import {GitRepository} from '../models/git-repository';
import {StorageName} from '../enums/storage-name.enum';
import {SettingsService} from './settings.service';
import {byDirectory, isRootDirectory, notUndefined, throwEx} from '../utils/utils';
import {createRepository, filterOutStashes} from '../utils/repository-utils';

import * as fs from 'fs';
import * as path from 'path';
import * as electron from '@electron/remote';
import {LogService} from './electron-cmd-parser-layer/log.service';
import {StashService} from './electron-cmd-parser-layer/stash.service';
import {BranchService} from './electron-cmd-parser-layer/branch.service';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';

const DEFAULT_NUMBER_OR_COMMITS_TO_SHOW = 1200;

/**
 * State manager for Git repositories.
 *
 * - Tracks opened repositories and current selection
 * - Persist repository state to local storage
 * - Coordinate git/log/branch/stash services
 * - React to window focus and filesystem changes
 *
 * FIXME: Too complicated
 */
@Injectable({
  providedIn: 'root',
})
export class GitRepositoryService {

  private fs: typeof fs = (window as any).require('fs');
  private path: typeof path = (window as any).require('path');
  private electron: typeof electron = (window as any).require('@electron/remote');
  private dialog = this.electron.dialog;
  repositories$: BehaviorSubject<GitRepository>[] = [];
  currentRepositoryIndex$ = new BehaviorSubject<number>(-1);

  private settingsService = inject(SettingsService);
  private logService = inject(LogService);
  private branchService = inject(BranchService);
  private stashService = inject(StashService);
  private gitApiService = inject(GitApiService);
  readonly windowFocused$ = new Subject();

  constructor() {

    // Restore persisted repositories
    (this.settingsService.get<GitRepository[]>(StorageName.GitRepositories) ?? []).forEach(this.addToRepos);

    // Refresh data when window regains focus
    this.electron.getCurrentWindow().on('focus', () => {
      this.windowFocused$.next(true);
      this.updateLogsAndBranches().subscribe(this.updateCurrentRepository);
    });

  }

  get currentRepository(): GitRepository | undefined {
    return this.currentRepositoryIndex$.value >= 0
      ? this.repositories$[this.currentRepositoryIndex$.value]?.value
      : undefined;
  }

  // Just saves changes of current repo, doesn't trigger subscribers
  saveAllRepos = (repos: GitRepository[]) => this.settingsService.store(StorageName.GitRepositories, repos);

  selectRepositoryByIndex = (repositoryIndex: number) => {
    // Deselect current repo
    this.updateCurrentRepository({selected: false});

    // Select the good one
    this.currentRepositoryIndex$.next(repositoryIndex);
    this.updateCurrentRepository({selected: true});
  };

  /**
   * Opens or retrieve repository after user picks a repo folder
   * - Reuses an existing repo if already opened
   * - Marks it as selected
   * - Refreshes logs, branches, and stashes
   */
  openRepository = () => {
    const repoDirectory = this.pickGitFolder();

    const repo$ = this.repositories$.find(byDirectory(repoDirectory)) ?? this.addToRepos(createRepository(repoDirectory));
    this.currentRepositoryIndex$.next(this.repositories$.indexOf(repo$));

    this.updateRepo(repo$, {selected: true});

    // Git log and update current repo
    return this.updateLogsAndBranches().pipe(tap(this.updateCurrentRepository));
  };

  pickGitFolder = () => {

    const pickedGitFolder = (this.dialog.showOpenDialogSync({properties: ['openDirectory']}) ?? throwEx('No folder current'))[0];

    return this.findGitDir(pickedGitFolder);

  };

  /**
   * Walks up the picked directory tree until a `.git` folder is found.
   * Throws if no git repository exists.
   */
  findGitDir = (gitDir: string): string => {

    if (this.fs.statSync(gitDir).isFile())
      return this.findGitDir(this.path.dirname(gitDir));

    const files = this.fs.readdirSync(gitDir);
    if (files.includes('.git'))
      return gitDir;
    else if (isRootDirectory(gitDir))
      return throwEx(`This folder is not a valid git repository`);
    else
      return this.findGitDir(this.path.resolve(gitDir, '..'));

  };

  /**
   * Removes a repository and updates selection:
   * - If the removed repo was selected, selects the nearest neighbor
   * - Persists updated repository list
   */
  removeRepository = (repoIndex: number) => {
    const repoToRemoveWascurrent = this.repositories$[repoIndex].value.selected;

    const toRemove = this.repositories$[repoIndex];
    toRemove.unsubscribe();

    this.repositories$ = this.repositories$.filter((_, i) => i !== repoIndex);

    // Selects the next repository in next tab (if available)
    if (repoToRemoveWascurrent && this.repositories$.length) {
      if (this.repositories$.length >= repoIndex)
        this.selectRepositoryByIndex(repoIndex);
      else if (repoIndex - 1 >= 0)
        this.selectRepositoryByIndex(repoIndex - 1);

      // Else, no repos at all, nothing to select !
    }

  };

  fetchCurrentRepository = () => {
    if (this.currentRepositoryIndex$.value == -1) return;

    this.git(['fetch']);
    this.updateLogsAndBranches().subscribe(this.updateCurrentRepository);
  };

  private updateRepo = (repository$: BehaviorSubject<GitRepository>, updates: Partial<GitRepository>) =>
    repository$?.next({...repository$.value, ...updates});

  /**
   * Adds a repository to the internal list and wires persistence.
   * Any change to the repo state is debounced and saved to storage.
   */
  private addToRepos = (repo: GitRepository) => {
    const repo$ = new BehaviorSubject(repo);

    const insertedIndex = this.repositories$.push(repo$) - 1;
    if (repo.selected) this.currentRepositoryIndex$.next(insertedIndex);

    // Stores repositories changes into localstorage
    repo$
      .pipe(debounceTime(500)) // Skip fast edits
      .subscribe(() => this.saveAllRepos(this.repositories$.map(repo$ => repo$.value)));

    return repo$;
  };

  /**
   * Fetches logs, branches, and stashes for the current repository
   * and returns a partial repository update.
   */
  private updateLogsAndBranches = (): Observable<Partial<GitRepository>> =>
    this.stashService.getStashes(this.git).pipe(switchMap(stashes => forkJoin({
      logs: this.logService.getCommitLog(this.git, '--branches', DEFAULT_NUMBER_OR_COMMITS_TO_SHOW, 0, ['--remotes', '--tags', '--source', ...stashes.map(s => s.sha)])
        .pipe(map(logs => logs.filter(filterOutStashes(stashes)))),
      branches: this.branchService.getBranches(this.git), // Source will show which branch the  commit is in
      stashes: of(stashes), // Source will show which branch commit is in
    })));

  updateCurrentRepository = (updates: Partial<GitRepository>) => {
    if (this.currentRepositoryIndex$.value != -1) this.updateRepo(this.repositories$[this.currentRepositoryIndex$.value], updates);
  };

  git = (args: (string | undefined)[] = []) => this.gitApiService.git(args.filter(notUndefined), this.currentRepository?.directory);
}
