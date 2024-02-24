import {Injectable} from '@angular/core';
import {BehaviorSubject, filter, from, map, Observable, switchMap, tap} from "rxjs";
import {SettingsService} from "./settings.service";
import {StorageName} from "../enums/storage-name.enum";
import {GitRepository} from "../models/git-repository";
import {checkFolderIsGitRepository, lastFolderName} from "../utils/utils";
import {NodeApiService} from "./node-api.service";
import {os} from "@neutralinojs/lib";
import showFolderDialog = os.showFolderDialog;
import execCommand = os.execCommand;

@Injectable({
    providedIn: 'root'
})
export class GitRepositoryService {

    private repositories$;

    constructor(
        private settingsService: SettingsService,
        private nodeApiService: NodeApiService,
    ) {
        this.repositories$ = new BehaviorSubject<GitRepository[]>(settingsService.get<GitRepository[]>(StorageName.GitRepositories) ?? [])

        // Storing repositories modifications into localstorage
        this.repositories$.subscribe(repoChanges => settingsService.store(StorageName.GitRepositories, repoChanges));
    }

    get repositories() {
        return this.repositories$.getValue();
    }

    getUsername = async () => {
        // const key = os.NL_OS == 'Windows' ? 'USERNAME' : 'USER';
        ;
    }

    openRepository = () => {
        this.getUsername();
        from(showFolderDialog('Open a git repository', {defaultPath: '~/Documents'}))
            .pipe(
                filter(checkFolderIsGitRepository),
                map(s => s as string),
                filter(this.repositoryNotAlreadyImported),
                map(this.toNewRepository),
                tap(this.addAndSelectRepository), // Show repository displaying in interface
                switchMap(repo => this.updateBranches(repo.directory)), //
            )
            .subscribe(console.log);
    }

    addAndSelectRepository = (gitRepository: GitRepository) => {
        this.repositories$.next([...this.repositories.map(repo => ({...repo, selected: false})), {
            ...gitRepository,
            selected: true
        }]);
    }

    /**
     * Saves state of a repo
     */
    saveRepository = (repoName: string, repoEdits: Partial<GitRepository>) => {
        const repos = this.repositories;
        const repoToEditIndex = repos.findIndex(r => r.name == repoName);

        repos[repoToEditIndex] = {...repos[repoToEditIndex], ...repoEdits};

        this.repositories$.next(repos);
    }

    removeRepository = (repositoryDirectory: string) => this.repositories$.next(this.repositories.filter(r => r.directory != repositoryDirectory));

    selectRepository = (index: number) => this.repositories$.next(this.repositories.map((repo, i) => ({
        ...repo,
        selected: i == index
    })));

    selectedRepository = (): GitRepository => this.repositories.find(r => r.selected)!;

    private repositoryNotAlreadyImported = (directory: string) => !this.repositories.find(r => r.directory == directory);

    private toNewRepository = (directory: string): GitRepository => ({
        name: lastFolderName(directory),
        directory,
        sizes: [20, 50, 30],
        selected: true,
        localBranches: [],
    })

    private updateBranches = (directory: string): Observable<Partial<GitRepository>> =>
        from(execCommand('git branch', {cwd: directory}))
            .pipe(
                tap(results => console.log(results)),
                map(result => ({localBranches: result.stdOut.split('\n')})),
            );

}
