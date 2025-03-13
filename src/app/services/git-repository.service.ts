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
  private repositories$;

  constructor(
    private settingsService: SettingsService,
    private logService: LogService,
    private branchService: BranchService,
    private stashService: StashService,
  ) {
    this.repositories$ = new BehaviorSubject<GitRepository[]>(settingsService.get<GitRepository[]>(StorageName.GitRepositories) ?? [])

    // Storing repositories modifications into localstorage
    this.repositories$.subscribe(this.saveRepoChanges);
  }

  get repositories() {
    return this.repositories$.getValue();
  }

  get selectedRepository(): GitRepository | undefined {
    return this.repositories.find(r => r.selected);
  }

  get activeIndex() {
    return this.repositories.findIndex(r => r.directory == this.selectedRepository?.directory);
  };

  // Just saves changes of current repo, doesn't trigger subscribers
  saveRepoChanges = (repos: GitRepository[]) => this.settingsService.store(StorageName.GitRepositories, repos)

  selectRepositoryByIndex = (repositoryIndex: number) =>
    this.repositories$.next(this.repositories.map((repo, index) => ({...repo, selected: index == repositoryIndex})));

  // Clicks on a tab to select a repo, or opens a new one
  selectRepository = (filterFunction: (repo: GitRepository) => boolean) =>
    this.repositories$.next(this.repositories.map(repo => ({...repo, selected: filterFunction(repo)})));

  /**
   * Opens or retrieve repository after user picks a repo folder
   */
  openRepository = () => {
    const repoDirectory = this.pickGitFolder();

    const repo = this.repositories.find(byDirectory(repoDirectory)) ?? this.addToRepos(createRepository(repoDirectory));
    repo.selected = true;

    this.selectRepository(r => r.directory == repo.directory);

    return this.updateLogsAndBranches(repo)
      .pipe(tap(this.updateRepositories));
  }

  pickGitFolder = () => {

    const pickedGitFolder = (this.dialog.showOpenDialogSync({properties: ['openDirectory']}) ?? throwEx('No folder selected'))[0];

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

  /**
   * Saves state of a repo
   */
  modifyCurrentRepository = (repoEdits: Partial<GitRepository>, triggerChanges = true) => {
    const editedRepos = this.repositories.map(repo => repo.selected ? {...repo, ...repoEdits} : repo);
    triggerChanges ? this.repositories$.next(editedRepos) : this.saveRepoChanges(editedRepos);
  }

  removeRepository = (repoIndex: number) => {
    const repoToRemove = this.repositories.find(byIndex(repoIndex))!;

    // Effectively remove the repo from the repo list
    this.repositories$.next(this.repositories.filter((_, i) => i !== repoIndex));

    // Selects the next repository in next tab (if available)
    if (repoToRemove.selected) {
      if (this.repositories.length >= repoIndex)
        this.selectRepositoryByIndex(repoIndex);
      else if (repoIndex - 1 >= 0)
        this.selectRepositoryByIndex(repoIndex - 1);

      // Else, no repos at all, nothing to select !
    }

  }

  private updateRepositories = (updatedRepo: GitRepository) =>
    this.repositories$.next(this.repositories.map(r => r.directory == updatedRepo.directory ? updatedRepo : r));

  private addToRepos = (repo: GitRepository) => {
    this.repositories$.next([...this.repositories, repo]);
    return repo
  }

  private updateLogsAndBranches = (gitRepository: GitRepository): Observable<GitRepository> =>
    forkJoin({
      logs: this.logService.getCommitLog(gitRepository.directory, '--branches', 2000, 0, ['--remotes', '--tags', '--source']), // Source will show which branch the commit is in
      branches: this.branchService.getBranches(gitRepository.directory), // Source will show which branch the  commit is in
      stashes: this.stashService.getStashes(gitRepository.directory), // Source will show which branch commit is in
    })
      .pipe(map(updates => ({...gitRepository, ...updates})), tap(console.log));

}
