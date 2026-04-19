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
import {PopupService} from '../services/popup.service';

export class GlobalErrorHandler implements ErrorHandler {

  private readonly popupService = inject(PopupService);

  handleError(error: unknown): void {
    console.error('[GlobalErrorHandler]', error);

    if (error instanceof Error) {
      this.popupService.err(error.message);
    }
  }
}
