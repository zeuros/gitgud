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

import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ButtonDirective} from 'primeng/button';
import {Textarea} from 'primeng/textarea';
import {type DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import type {Observable} from 'rxjs';

/** Asks what the new worktree agent should do; closes with the prompt, or undefined */
export const openNewAgentDialog = (dialog: DialogService): Observable<string | undefined> =>
  dialog.open(NewAgentDialogComponent, {header: 'New worktree agent', width: '560px'})!.onClose;

@Component({
  selector: 'gitgud-new-agent-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonDirective, Textarea],
  template: `
    <div class="flex flex-column gap-3 pt-2">
      <span class="text-gray">Claude works on it in a new worktree and branch, named after the task, from HEAD.</span>
      <textarea pTextarea rows="6" class="w-full" placeholder="What should Claude do?" autofocus
                [ngModel]="prompt()" (ngModelChange)="prompt.set($event)" (keydown.control.enter)="start()"></textarea>
      <div class="flex gap-2 justify-content-end">
        <button pButton text severity="secondary" (click)="ref.close(undefined)">Cancel</button>
        <button pButton (click)="start()" [disabled]="!prompt().trim()" title="Ctrl+Enter">Start</button>
      </div>
    </div>
  `,
})
export class NewAgentDialogComponent {

  protected ref = inject(DynamicDialogRef<string | undefined>);

  protected prompt = signal('');

  protected start() {
    if (this.prompt().trim()) this.ref.close(this.prompt().trim());
  }
}
