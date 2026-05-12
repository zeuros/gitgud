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
import {DialogService} from 'primeng/dynamicdialog';
import {map, tap} from 'rxjs';
import {PromptDialogComponent} from '../components/dialogs/prompt-dialog/prompt-dialog.component';

@Injectable({providedIn: 'root'})
export class PromptService {

  private dialog = inject(DialogService);

  open = (label: string, required = true) =>
    this.dialog.open(PromptDialogComponent, {
      header: label,
      width: '400px',
      modal: true,
      data: {label, required},
    })!.onClose.pipe(map((r?: string) => r?.trim().length ? r : null), tap(this.closeAll));

  // Clear dialog references to avoid reuse
  closeAll = () => this.dialog.dialogComponentRefMap.clear();
}