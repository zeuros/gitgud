import {Injectable} from '@angular/core';
import {MessageService, ToastMessageOptions} from "primeng/api";
import {errorMessage} from "../utils/utils";

const defaultMessageConfig: ToastMessageOptions = {styleClass: 'headLess', text: '', life: 5000};

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
