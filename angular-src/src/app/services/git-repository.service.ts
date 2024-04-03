import {Injectable} from '@angular/core';
import {BehaviorSubject} from "rxjs";
import {SettingsService} from "./settings.service";
import {GitRepository} from "../models/git-repository";
import {StorePlace} from "../enums/store-place.enum";

@Injectable({
    providedIn: 'root'
})
export class GitRepositoryService {

    repositories$;

    constructor(
        private settingsService: SettingsService,
    ) {
        this.repositories$ = new BehaviorSubject<GitRepository[]>(settingsService.get<GitRepository[]>(StorePlace.GitRepositories) ?? [])
        this.repositories$.subscribe(repoChanges => settingsService.store(StorePlace.GitRepositories, repoChanges));
    }


    openRepository = () => {
    }

    addRepository = (gitRepository: GitRepository) => this.repositories$.next([...this.repositories$.getValue(), gitRepository]);

}
