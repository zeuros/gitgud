import {Injectable} from '@angular/core';
import {GitTools} from "../models/git-tools";
import {catchError, from, throwError} from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class GitToolsService {

    // Git tools is an ipc api
    private gitTools = (window as any).gitTools as GitTools;

    clone = (repositoryUrl: string, directory: string) => from(this.gitTools.clone(repositoryUrl, directory).catch(this.doProperErrorManagement));

    private doProperErrorManagement = (e: any) => {
        console.error(e); // TODO: proper error management
    }

}
