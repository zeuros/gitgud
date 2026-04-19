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

import { Component, inject } from '@angular/core';
import {FormControl, ReactiveFormsModule } from '@angular/forms';
import {Button} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';

@Component({
  selector: 'gitgud-prompt-dialog',
  imports: [ReactiveFormsModule, Button, InputText],
  template: `
    <div class="flex flex-column gap-3 pt-2">
      <input pInputText [formControl]="textInput" (keydown.enter)="confirm()" autofocus/>
      <div class="flex gap-2 justify-content-end">
        <p-button label="Cancel" [text]="true" severity="secondary" (click)="cancel()"/>
        <p-button label="Confirm" (click)="confirm()" [disabled]="required && !textInput.value.length"/>
      </div>
    </div>
  `,
})
export class PromptDialogComponent {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig);

  protected readonly required: boolean = this.config.data?.required ?? true;
  protected readonly textInput = new FormControl('', { nonNullable: true });

  protected confirm = () => this.ref.close(this.textInput.value);
  protected cancel = () => this.ref.close(null);
}