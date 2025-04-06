import {inject, Injectable} from '@angular/core';
import {BehaviorSubject, debounceTime, forkJoin, Observable, tap} from "rxjs";
import {GitRepository} from "../models/git-repository";
import {StorageName} from "../enums/storage-name.enum";
import {SettingsService} from "./settings.service";
import {byDirectory, isRootDirectory, throwEx} from "../utils/utils";
import {createRepository} from "../utils/repository-utils";

import * as fs from 'fs';
import * as path from 'path';
import * as electron from "@electron/remote";
import {LogService} from "./electron-cmd-parser-layer/log.service";
import {StashService} from "./electron-cmd-parser-layer/stash.service";
import {BranchService} from "./electron-cmd-parser-layer/branch.service";
import {GitApiService} from "./electron-cmd-parser-layer/git-api.service";

const DEFAULT_NUMBER_OR_COMMITS_TO_SHOW = 400;

/**
 * Holds repositories and their states
 */
@Injectable({
  providedIn: 'root'
})
export class GitRepositoryService {

  private fs: typeof fs = (window as any).require('fs');
  private path: typeof path = (window as any).require('path');
  private electron: typeof electron = (window as any).require('@electron/remote')
  private dialog = this.electron.dialog;
  private repositories$: BehaviorSubject<GitRepository>[] = [];
  currentRepositoryIndex?: number;

  private settingsService = inject(SettingsService);
  private logService = inject(LogService);
  private branchService = inject(BranchService);
  private stashService = inject(StashService);
  private gitApiService = inject(GitApiService);

  constructor() {

    (this.settingsService.get<GitRepository[]>(StorageName.GitRepositories) ?? []).forEach(this.addToRepos);

    this.electron.getCurrentWindow().on('focus', () => this.updateLogsAndBranches().subscribe(this.updateCurrentRepository));

  }

  private get currentRepository(): GitRepository | undefined {
    return this.repositories$[this.currentRepositoryIndex!]?.value;
  }

  // Just saves changes of current repo, doesn't trigger subscribers
  saveAllRepos = (repos: GitRepository[]) => this.settingsService.store(StorageName.GitRepositories, repos)

  selectRepositoryByIndex = (repositoryIndex: number) => {
    // Deselect current repo
    this.updateCurrentRepository({selected: false});

    // Select the good one
    this.currentRepositoryIndex = repositoryIndex;
    this.updateCurrentRepository({selected: true});
  }

  /**
   * Opens or retrieve repository after user picks a repo folder
   */
  openRepository = () => {
    const repoDirectory = this.pickGitFolder();

    const repo$ = this.repositories$.find(byDirectory(repoDirectory)) ?? this.addToRepos(createRepository(repoDirectory));
    this.currentRepositoryIndex = this.repositories$.indexOf(repo$);

    this.updateRepo(repo$, {selected: true});

    // Git log and update current repo
    return this.updateLogsAndBranches().pipe(tap(this.updateCurrentRepository));
  }

  pickGitFolder = () => {

    const pickedGitFolder = (this.dialog.showOpenDialogSync({properties: ['openDirectory']}) ?? throwEx('No folder current'))[0];

    return this.findGitDir(pickedGitFolder);

  }

  /**
   * Lookup in parent folder, and check if path corresponds to a git repo
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
      return this.findGitDir(this.path.resolve(gitDir, '..'))

  }

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

  }

  fetchCurrentRepository = () => {
    if (this.currentRepositoryIndex != undefined) {
      this.git(['fetch']);
      this.updateLogsAndBranches().subscribe(this.updateCurrentRepository);
    }
  }

  private updateRepo = (repository$: BehaviorSubject<GitRepository>, updates: Partial<GitRepository>) =>
    repository$?.next({...repository$.value, ...updates});

  private addToRepos = (repo: GitRepository) => {
    const repo$ = new BehaviorSubject(repo);

    const insertedIndex = this.repositories$.push(repo$) - 1;
    if (repo.selected) this.currentRepositoryIndex = insertedIndex;

    // Always stores repositories changes into localstorage
    repo$
      .pipe(debounceTime(500)) // Skip fast edits
      .subscribe(() => this.saveAllRepos(this.repositories$.map(repo$ => repo$.value)));

    return repo$;
  }

  private updateLogsAndBranches = (): Observable<Partial<GitRepository>> =>
    forkJoin({
      logs: this.logService.getCommitLog(this.git, '--branches', DEFAULT_NUMBER_OR_COMMITS_TO_SHOW, 0, ['--remotes', '--tags', '--source']), // Source will show which branch the commit is in
      branches: this.branchService.getBranches(this.git), // Source will show which branch the  commit is in
      stashes: this.stashService.getStashes(this.git), // Source will show which branch commit is in
    });

  updateCurrentRepository = (updates: Partial<GitRepository>) => {
    if (this.currentRepositoryIndex != undefined) this.updateRepo(this.repositories$[this.currentRepositoryIndex], updates);
  }

  git = (args: string[] = []) => this.gitApiService.git(args, this.currentRepository?.directory);
}
