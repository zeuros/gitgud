import {Injectable} from '@angular/core';
import {GitTools} from "../models/git-tools";
import {from, tap} from "rxjs";
import {PopupService} from "./popup.service";

@Injectable({
    providedIn: 'root'
})
export class GitToolsService {

    constructor(
        private popupService: PopupService,
    ) {
    }

    // Git tools is an ipc api
    private gitTools = (window as any).gitTools as GitTools;

    clone = (repositoryUrl: string, directory: string) => from(this.gitTools.clone(repositoryUrl, directory).catch(this.popupService.error));

    sampleError = () => from(this.gitTools.sampleError().catch(this.popupService.error));

}
