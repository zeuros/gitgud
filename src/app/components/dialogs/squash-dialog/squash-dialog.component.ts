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

import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ButtonDirective, ButtonLabel} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {Textarea} from 'primeng/textarea';
import {DialogService, DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {type Observable} from 'rxjs';
import {type Commit} from '../../../lib/github-desktop/model/commit';

// Asks for the message of the commit `chain` (newest first) is squashed into, null when cancelled
export const openSquashDialog = (dialog: DialogService, chain: Commit[]): Observable<string | null> =>
  dialog.open(SquashDialogComponent, {header: `Squash ${chain.length} commits`, width: '560px', data: {chain}})!.onClose;

const fullMessage = ({summary, body}: Commit) => `${summary}\n\n${body}`.trim();

@Component({
  selector: 'gitgud-squash-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputText, Textarea, FormsModule, ButtonDirective, ButtonLabel],
  styleUrl: './squash-dialog.component.scss',
  template: `
    <form class="flex flex-column pt-2" (ngSubmit)="confirm()" (keydown.control.enter)="confirm()">
      <input pInputText placeholder="Summary" class="w-full commit-summary" [formControl]="summary" autofocus/>
      <textarea pTextarea placeholder="Description" rows="8" class="w-full commit-description" [formControl]="description"></textarea>
      <div class="flex gap-2 justify-content-end mt-3">
        <button pButton [text]="true" severity="secondary" (click)="cancel()">Cancel</button>
        <button pButton type="submit" [disabled]="!summary.value.trim()">Squash</button>
      </div>
    </form>
  `,
})
export class SquashDialogComponent {
  private ref = inject(DynamicDialogRef<string | null>);
  private config = inject(DynamicDialogConfig);

  private chain: Commit[] = this.config.data.chain;

  // Prefilled like git's own squash message: the oldest commit's, followed by the newer ones'
  protected summary = new FormControl(this.chain.at(-1)!.summary, {nonNullable: true});
  protected description = new FormControl(
    [this.chain.at(-1)!.body.trim(), ...this.chain.slice(0, -1).reverse().map(fullMessage)].filter(Boolean).join('\n\n'),
    {nonNullable: true},
  );

  protected confirm = () => {
    if (!this.summary.value.trim()) return;
    this.ref.close(`${this.summary.value.trim()}\n\n${this.description.value}`.trim());
  };

  protected cancel = () => this.ref.close(null);
}
