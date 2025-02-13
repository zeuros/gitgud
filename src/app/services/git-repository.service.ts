import {Injectable} from '@angular/core';
import {BehaviorSubject} from "rxjs";
import {GitRepository} from "../models/git-repository";
import {StorageName} from "../enums/storage-name.enum";
import {SettingsService} from "./settings.service";
import {byIndex, byDirectory, throwEx} from "../utils/utils";
import {directoryToNewRepository} from "../utils/repository-utils";
import {GitApiService} from "./git-api.service";

/**
 * Holds repositories and their states
 */
@Injectable({
  providedIn: 'root'
})
export class GitRepositoryService {

  private repositories$;

  constructor(
    settingsService: SettingsService,
    private gitApiService: GitApiService,
  ) {
    this.repositories$ = new BehaviorSubject<GitRepository[]>(settingsService.get<GitRepository[]>(StorageName.GitRepositories) ?? [])

    // Storing repositories modifications into localstorage
    this.repositories$.subscribe(repoChanges => settingsService.store(StorageName.GitRepositories, repoChanges));
  }

  get repositories() {
    return this.repositories$.getValue();
  }

  get selectedRepository() {
    return this.repositories.find(r => r.selected) ?? throwEx('No repo selected');
  }

  get activeIndex() {
    return this.repositories.findIndex(r => r.directory == this.selectedRepository?.directory);
  };

  selectRepositoryByIndex = (repositoryIndex: number) =>
    this.repositories$.next(this.repositories.map((repo, index) => ({...repo, selected: index == repositoryIndex})));

  selectRepository = (filterFunction: (repo: GitRepository) => boolean) =>
    this.repositories$.next(this.repositories.map((repo, index) => ({...repo, selected: filterFunction(repo)})));

  openRepository = () => {
    const repoDirectory = this.gitApiService.pickGitFolder();

    const existingRepository = this.repositories.find(byDirectory(repoDirectory));

    if (existingRepository) {
      this.selectRepository(repo => repo.directory == existingRepository.directory);
    } else {
      this.createAndSelectRepository(repoDirectory);
    }

    return this.selectedRepository;
  }

  createAndSelectRepository = (gitDir: string) => {
    this.repositories$.next([
      ...this.repositories.map(r => ({...r, selected: false})),
      directoryToNewRepository(gitDir),
    ]);
  };

  /**
   * Saves state of a repo
   */
  modifyCurrentRepository = (repoEdits: Partial<GitRepository>) =>
    this.repositories$.next(this.repositories.map(repo => repo.selected ? {...repo, ...repoEdits} : repo));

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

  private repositoryNotAlreadyImported = (directory: string) => !this.repositories.find(r => r.directory == directory);

  // private readRepository(repositoryPath: string): GitRepository {
  //   const existingRepository = this.repositories.find(byPath(repositoryPath));
  //   if (existingRepository) return existingRepository;
  //
  //   // Create repository object
  //   this.repositories.push()
  //     .pipe(
  //       tap(this.openRepository),
  //       switchMap(dir => forkJoin([
  //         this.electronService.logAll(dir),
  //         this.electronService.listRemoteBranches(dir),
  //         this.electronService.currentBranch(dir),
  //         this.electronService.listRemotes(dir),
  //       ])),
  //       // tap(([branchesAndLogs, remoteBranches, currentBranch, remotes]) => this.modifyCurrentRepository({branchesAndLogs, remoteBranches, currentBranch, remotes})),
  //     )
  // }
}
