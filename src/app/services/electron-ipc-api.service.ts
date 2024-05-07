import {Injectable} from '@angular/core';
import {ElectronIpcApi} from "../models/electron-ipc-api";
import {from, map} from "rxjs";
import {PopupService} from "./popup.service";

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

    log = (directory: string) => from(this.electronIpcApi.log({dir: directory, depth: 2000}).catch(this.popupService.error)).pipe(map(notUndefined));

    listRemotes = (dir: string) => from(this.electronIpcApi.listRemotes({dir}).catch(this.popupService.error)).pipe(map(notUndefined));

    listLocalBranches = (dir: string) => from(this.electronIpcApi.listBranches({dir}).catch(this.popupService.error)).pipe(map(notUndefined));

    listRemoteBranches = (dir: string, remote = 'origin') => from(this.electronIpcApi.listBranches({dir, remote}).catch(this.popupService.error)).pipe(map(notUndefined));

    sampleError = () => from(this.electronIpcApi.sampleError().catch(this.popupService.error));

}
