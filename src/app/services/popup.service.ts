import {Injectable} from '@angular/core';
import {MessageService} from "primeng/api";

@Injectable({
    providedIn: 'root'
})
export class PopupService {

    constructor(
        private messageService: MessageService,
    ) {

    }

    public info = (message: any) => this.messageService.add({severity: 'info', detail: message.toString()});

    public error = (e: any) => {
        const backendErrorMessage = e.toString().replace(/Error: Error invoking remote method (.*):/, ''); // TODO: show this in popup service:
        this.messageService.add({severity: 'error', detail: backendErrorMessage});
        console.error(e);
    }
}
