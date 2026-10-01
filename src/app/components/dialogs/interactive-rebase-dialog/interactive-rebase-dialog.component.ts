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

import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray} from '@angular/cdk/drag-drop';
import {Button} from 'primeng/button';
import {Select} from 'primeng/select';
import {Textarea} from 'primeng/textarea';
import {DialogService, DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {type Observable} from 'rxjs';
import {invalidRebaseReason, type RebaseAction, type RebaseEntry, summary} from '../../../utils/interactive-rebase.utils';
import {short} from '../../../utils/commit-utils';

interface InteractiveRebaseData {
  entries: RebaseEntry[]; // Newest first
  onto: string;
  mergesCount: number;
}

export const openInteractiveRebaseDialog = (dialog: DialogService, data: InteractiveRebaseData): Observable<RebaseEntry[] | undefined> =>
  dialog.open(InteractiveRebaseDialogComponent, {header: `Interactive rebase onto ${data.onto}`, width: '850px', data})!.onClose;

@Component({
  selector: 'gitgud-interactive-rebase-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, Button, Select, Textarea, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './interactive-rebase-dialog.component.html',
  styleUrl: './interactive-rebase-dialog.component.scss',
})
export class InteractiveRebaseDialogComponent {
  private ref = inject(DynamicDialogRef<RebaseEntry[]>);
  private config = inject(DynamicDialogConfig<InteractiveRebaseData>);

  protected entries = signal<RebaseEntry[]>(this.config.data!.entries);
  protected mergesCount = this.config.data!.mergesCount;
  protected invalidReason = computed(() => invalidRebaseReason(this.entries()));

  protected actions: { label: string, value: RebaseAction }[] = [
    {label: 'Pick', value: 'pick'},
    {label: 'Reword', value: 'reword'},
    {label: 'Squash', value: 'squash'},
    {label: 'Fixup', value: 'fixup'},
    {label: 'Drop', value: 'drop'},
  ];

  protected short = short;
  protected summary = summary;

  protected drop = ({previousIndex, currentIndex}: CdkDragDrop<RebaseEntry[]>) =>
    this.entries.update(entries => {
      const moved = [...entries];
      moveItemInArray(moved, previousIndex, currentIndex);
      return moved;
    });

  protected patch = (index: number, changes: Partial<RebaseEntry>) =>
    this.entries.update(entries => entries.map((entry, i) => i == index ? {...entry, ...changes} : entry));

  protected confirm = () => this.ref.close(this.entries());
  protected cancel = () => this.ref.close(undefined);
}
