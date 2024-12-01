import {Injectable} from '@angular/core';
import {BehaviorSubject, forkJoin, of, switchMap, tap} from "rxjs";
import {GitRepository} from "../models/git-repository";
import {StorageName} from "../enums/storage-name.enum";
import {SettingsService} from "./settings.service";
import {lastFolderName} from "../utils/utils";
import {ElectronIpcApiService} from "./electron-ipc-api.service";
import {directoryToNewRepository} from "../utils/repository-utils";

@Injectable({
    providedIn: 'root'
})
export class GitRepositoryService {

    private repositories$;

    constructor(
        settingsService: SettingsService,
        private electronIpcApiService: ElectronIpcApiService,
    ) {
        this.repositories$ = new BehaviorSubject<GitRepository[]>(settingsService.get<GitRepository[]>(StorageName.GitRepositories) ?? [])

        // Storing repositories modifications into localstorage
        this.repositories$.subscribe(repoChanges => settingsService.store(StorageName.GitRepositories, repoChanges));
    }

    get repositories() {
        return this.repositories$.getValue();
    }

    get selectedRepository() {
        return this.repositories.find(r => r.selected);
    }

    get activeIndex() {
        return this.repositories.findIndex(r => r.name == this.selectedRepository?.name);
    };

    selectRepositoryByIndex = (repositoryIndex: number) =>
        this.repositories$.next(this.repositories.map((repo, index) => ({...repo, selected: index == repositoryIndex})));

    selectRepository = (filterFunction: (repo: GitRepository) => boolean) =>
        this.repositories$.next(this.repositories.map((repo, index) => ({...repo, selected: filterFunction(repo)})));

    resolveRef = () => this.electronIpcApiService.resolveRef(this.selectedRepository!.directory);

    openExistingRepository = () => of({}).pipe(
        switchMap(this.electronIpcApiService.openFolderPicker),
        tap(this.openRepository),
        switchMap(dir => forkJoin([
            this.electronIpcApiService.logAll(dir),
            this.electronIpcApiService.listRemoteBranches(dir),
            this.electronIpcApiService.currentBranch(dir),
            this.electronIpcApiService.listRemotes(dir),
        ])),
        tap(([branchesAndLogs, remoteBranches, currentBranch, remotes]) => this.modifyCurrentRepository({branchesAndLogs, remoteBranches, currentBranch, remotes})),
    );

    private openRepository = (repoDirectory: string) => {
        const existingRepository = this.repositories.find(repo => repo.name == lastFolderName(repoDirectory));

        if (existingRepository)
            this.selectRepository(repo => repo.name == existingRepository.name);
        else
            this.createAndSelectRepository(repoDirectory);

        return this.selectedRepository;
    }

    createAndSelectRepository = (directory: string) => {
        this.repositories$.next([
            ...this.repositories.map(r => ({...r, selected: false})),
            directoryToNewRepository(directory),
        ]);
    };

    /**
     * Saves state of a repo
     */
    modifyCurrentRepository = (repoEdits: Partial<GitRepository>) =>
        this.repositories$.next(this.repositories.map(repo => repo.selected ? {...repo, ...repoEdits} : repo));

    removeRepository = (repository: GitRepository) => this.repositories$.next(this.repositories.filter(r => r.name != repository.name));

    private repositoryNotAlreadyImported = (directory: string) => !this.repositories.find(r => r.directory == directory);

}
