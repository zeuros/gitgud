import {Injectable} from '@angular/core';
import {BehaviorSubject, filter, from, map} from "rxjs";
import {SettingsService} from "./settings.service";
import {GitRepository} from "../models/git-repository";
import {StorePlace} from "../enums/store-place.enum";
import {checkFolderIsGitRepository, lastFolderName} from "../utils/utils";
import {Neu} from "../../main";

@Injectable({
    providedIn: 'root'
})
export class GitRepositoryService {

    private repositories$;

    constructor(
        private settingsService: SettingsService,
    ) {
        this.repositories$ = new BehaviorSubject<GitRepository[]>(settingsService.get<GitRepository[]>(StorePlace.GitRepositories) ?? [])

        // Storing repositories modifications into localstorage
        this.repositories$.subscribe(repoChanges => settingsService.store(StorePlace.GitRepositories, repoChanges));
    }

    get repositories() {
        return this.repositories$.getValue();
    }

    openRepository = () => {
        return from(Neu.os.showFolderDialog('Open git folder', {defaultPath: '~/Documents',}))
            .pipe(
                filter(checkFolderIsGitRepository),
                map(s => s as string),
                filter(this.repositoryNotAlreadyImported),
            )
            .subscribe(directory => {
                this.addRepository({
                    name: lastFolderName(directory),
                    directory,
                    sizes: [20, 50, 30]
                })
            });
    }

    addRepository = (gitRepository: GitRepository) => this.repositories$.next([...this.repositories, gitRepository]);

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

    private repositoryNotAlreadyImported = (directory: string) => !this.repositories.find(r => r.directory == directory);

}
