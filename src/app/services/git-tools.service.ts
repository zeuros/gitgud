import {Injectable} from '@angular/core';
import {GitTools} from "../models/git-tools";
import {from} from "rxjs";
import {MessageService} from "primeng/api";

@Injectable({
    providedIn: 'root'
})
export class GitToolsService {

    constructor(
        private messageService: MessageService,
    ) {
    }
    // Git tools is an ipc api
    private gitTools = (window as any).gitTools as GitTools;

    clone = (repositoryUrl: string, directory: string) => from(this.gitTools.clone(repositoryUrl, directory).catch(this.doProperErrorManagement));
    sampleError = () => from(this.gitTools.sampleError().catch(this.doProperErrorManagement));

    private doProperErrorManagement = (e: any) => {
        const backendErrorMessage = e.toString().replace(/Error: Error invoking remote method (.*):/, ''); // TODO: show this in popup service:
        this.messageService.add({ severity: 'error', summary: 'Error', detail: backendErrorMessage });
        console.error(e);
    }

}
