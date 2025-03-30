import {Injectable} from '@angular/core';
import {Message, MessageService} from "primeng/api";
import {errorMessage} from "../utils/utils";

const defaultMessageConfig: Message = {styleClass: 'headLess', summary: '', life: 5000};

@Injectable({
  providedIn: 'root'
})
export class PopupService {

  constructor(
    private messageService: MessageService,
  ) {
  }


  info = (message: Error | string) => this.messageService.add({...defaultMessageConfig, severity: 'info', detail: message.toString()});

  warn = (message: Error | string) => this.messageService.add({...defaultMessageConfig, severity: 'warn', detail: errorMessage(message)});

  err = (message: Error | string) => this.messageService.add({...defaultMessageConfig, severity: 'error', detail: errorMessage(message)});

}
