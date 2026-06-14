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

import {ErrorHandler, inject} from '@angular/core';
import {ToastService} from '../services/toast.service';

export class GlobalErrorHandler implements ErrorHandler {

  private toast = inject(ToastService);

  handleError(error: unknown): void {
    console.error('[GlobalErrorHandler]', error);

    let message: string | undefined;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      // Tauri IPC errors arrive as "exited N\n<stderr>" — strip the status prefix
      message = error.replace(/^exited \d+\n/, '').trim();
    }

    if (message) this.toast.err(message);
  }
}
