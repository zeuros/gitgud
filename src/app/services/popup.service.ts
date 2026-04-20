/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {inject, Injectable} from '@angular/core';
import {ConfirmationService, MessageService, ToastMessageOptions} from 'primeng/api';
import {Observable} from 'rxjs';
import {errorMessage} from '../utils/utils';

const defaultMessageConfig: ToastMessageOptions = {styleClass: 'headLess', text: '', life: 5000};

@Injectable({
  providedIn: 'root',
})
export class PopupService {

  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  success = (message: Error | string) => this.messageService.add({...defaultMessageConfig, severity: 'success', detail: message.toString()});

  info = (message: Error | string) => this.messageService.add({...defaultMessageConfig, severity: 'info', detail: message.toString()});

  warn = (message: Error | string) => this.messageService.add({...defaultMessageConfig, severity: 'warn', detail: errorMessage(message)});

  err = (message: Error | string) => this.messageService.add({...defaultMessageConfig, severity: 'error', detail: errorMessage(message)});

  confirm$ = (message: string, header = 'Confirm') => new Observable<void>(observer => {
    this.confirmationService.confirm({
      message,
      header,
      accept: () => { observer.next(); observer.complete(); },
      reject: () => observer.complete(),
    });
  });

}
