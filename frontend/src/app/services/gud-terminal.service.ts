import { Injectable } from '@angular/core';
import { TerminalService } from "primeng/terminal";
import { GitRepositoryService } from "./git-repository.service";

@Injectable({
    providedIn: 'root'
})
export class GudTerminalService {

    private commandHistory: string[] = [];

    constructor(
        private terminalService: TerminalService,
        private gitRepositoryService: GitRepositoryService,
    ) {
        // this.terminalService.commandHandler
        //     .pipe(
        //         tap(console.log),
        //         tap(this.commandHistory.push),
        //         map(prepareCommand(gitRepositoryService.selectedRepository().directory)),
        //         switchMap(command => from(invoke<string>("execute_command", command))),
        //     )
        //     .subscribe(r => this.terminalService.sendResponse(r));
    }

}
