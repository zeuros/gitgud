import {Injectable} from '@angular/core';
import {ElectronIpcApi} from "../models/electron-ipc-api";
import {from, map, Observable} from "rxjs";
import {PopupService} from "./popup.service";
import {ReadCommitResult} from "isomorphic-git";

export const notUndefined = <T>(a: T | void) => a as T;

@Injectable({
    providedIn: 'root'
})
export class ElectronIpcApiService {

    constructor(
        private popupService: PopupService,
    ) {
    }

    // Git tools is an ipc api
    private electronIpcApi = (window as any).electronIpcApi as ElectronIpcApi;

    clone = (repositoryUrl: string, directory: string) => from(this.electronIpcApi.clone(repositoryUrl, directory).catch(this.popupService.error));

    openFolderPicker = () => from(this.electronIpcApi.pickGitFolder().catch(this.popupService.error)).pipe(map(notUndefined));

    log = (directory: string): Observable<ReadCommitResult[]> => from(this.electronIpcApi.log({dir: directory, depth: 2000}).catch(this.popupService.error));

    sampleError = () => from(this.electronIpcApi.sampleError().catch(this.popupService.error));

}
