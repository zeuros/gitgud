import { Injectable } from '@angular/core';
import { open } from '@tauri-apps/api/dialog';
import { BehaviorSubject, filter, from, map } from "rxjs";
import { SettingsService } from "./settings.service";
import { StorageName } from "../enums/storage-name.enum";
import { GitRepository } from "../models/git-repository";
import { checkFolderIsGitRepository, lastFolderName } from "../utils/utils";

@Injectable({
    providedIn: 'root'
})
export class GitRepositoryService {

    repositories$;

    constructor(
        private settingsService: SettingsService,
    ) {
        this.repositories$ = new BehaviorSubject<GitRepository[]>(settingsService.get<GitRepository[]>(StorageName.GitRepositories) ?? [])
        this.repositories$.subscribe(repoChanges => settingsService.store(StorageName.GitRepositories, repoChanges));
    }


    openRepository = () => {
        return from(open({
            directory: true,
            multiple: false,
            defaultPath: '~/Documents',
        }))
            .pipe(
                filter(checkFolderIsGitRepository),
                map(s => s as string)
            )
            .subscribe(directory => this.addRepository({
                name: lastFolderName(directory),
                directory: directory
            }));
    }

    addRepository = (gitRepository: GitRepository) => this.repositories$.next([...this.repositories$.getValue(), gitRepository]);

}
