import {Injectable} from '@angular/core';
import {BehaviorSubject, forkJoin, map, Observable, tap} from "rxjs";
import {GitRepository} from "../models/git-repository";
import {StorageName} from "../enums/storage-name.enum";
import {SettingsService} from "./settings.service";
import {byDirectory, byIndex, isRootDirectory, throwEx} from "../utils/utils";
import {createRepository} from "../utils/repository-utils";

import * as fs from 'fs';
import * as path from 'path';
import * as electron from "@electron/remote";
import {LogService} from "./log.service";
import {StashService} from "./stash.service";
import {BranchService} from "./branch.service";
import {GitApiService} from "./git-api.service";

const DEFAULT_NUMBER_OR_COMMITS_TO_SHOW = 400;

/**
 * Holds repositories and their states
 */
@Injectable({
  providedIn: 'root'
})
export class GitRepositoryService {

  fs: typeof fs = (window as any).require('fs');
  path: typeof path = (window as any).require('path');
  electron: typeof electron = (window as any).require('@electron/remote')
  dialog = this.electron.dialog;
  private repositories$: BehaviorSubject<GitRepository>[] = [];
  currentRepositoryIndex = 0;

  constructor(
    private settingsService: SettingsService,
    private logService: LogService,
    private branchService: BranchService,
    private stashService: StashService,
  ) {
    (settingsService.get<GitRepository[]>(StorageName.GitRepositories) ?? []).forEach(this.addToRepos);
  }

  get repositories() {
    return this.repositories$.map(r => r.value);
  }

  // Just saves changes of current repo, doesn't trigger subscribers
  saveAllRepos = (repos: GitRepository[]) => this.settingsService.store(StorageName.GitRepositories, repos)

  selectRepositoryByIndex = (repositoryIndex: number) => {
    // Deselect all repos
    this.updateRepo(this.repositories$[this.currentRepositoryIndex], {selected: false});
    // Select the good one
    this.updateRepo(this.repositories$[repositoryIndex], {selected: true});
    this.currentRepositoryIndex = repositoryIndex;
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
    return this.updateLogsAndBranches(repo$.value).pipe(tap(this.updateCurrentRepository));
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

    delete this.repositories$[repoIndex];

    // Selects the next repository in next tab (if available)
    if (repoToRemoveWascurrent) {
      if (this.repositories.length >= repoIndex)
        this.selectRepositoryByIndex(repoIndex);
      else if (repoIndex - 1 >= 0)
        this.selectRepositoryByIndex(repoIndex - 1);

      // Else, no repos at all, nothing to select !
    }

  }

  private updateRepo = (repository$: BehaviorSubject<GitRepository>, updates: Partial<GitRepository>) =>
    repository$.next({...repository$.value, ...updates});


  private addToRepos = (repo: GitRepository) => {
    const repo$ = new BehaviorSubject(repo);

    this.repositories$.push(repo$);

    // Always stores repositories modifications into localstorage
    repo$.subscribe(() => this.saveAllRepos(this.repositories$.map(repo$ => repo$.value)));

    return repo$;
  }

  private updateLogsAndBranches = (gitRepository: GitRepository): Observable<GitRepository> =>
    forkJoin({
      logs: this.logService.getCommitLog(gitRepository.directory, '--branches', DEFAULT_NUMBER_OR_COMMITS_TO_SHOW, 0, ['--remotes', '--tags', '--source']), // Source will show which branch the commit is in
      branches: this.branchService.getBranches(gitRepository.directory), // Source will show which branch the  commit is in
      stashes: this.stashService.getStashes(gitRepository.directory), // Source will show which branch commit is in
    })
      .pipe(map(updates => ({...gitRepository, ...updates})));

  updateCurrentRepository = (updates: Partial<GitRepository>) => this.updateRepo(this.repositories$[this.currentRepositoryIndex], updates);

  // Just saves the repository WITHOUT triggering observers
  saveCurrentRepository = (edits: Partial<GitRepository>) => {
    this.saveAllRepos(this.repositories$
      .map(repo$ => repo$.value)
      .map((repo, i) => i == this.currentRepositoryIndex ? {...repo, ...edits} : repo));
  }
}
