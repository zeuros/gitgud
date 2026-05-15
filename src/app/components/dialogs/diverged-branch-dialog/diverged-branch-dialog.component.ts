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

import {Component, inject} from '@angular/core';
import {Button} from 'primeng/button';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';

export type DivergedBranchAction = 'reset' | 'merge' | null;

@Component({
  selector: 'gitgud-diverged-branch-dialog',
  standalone: true,
  imports: [Button],
  template: `
    <div class="flex flex-column gap-3 pt-2">
      <span>
        Local <strong>'{{ localBranch }}'</strong> has diverged from <strong>'{{ remoteBranch }}'</strong>.
        Choose how to reconcile.
      </span>
      <div class="flex gap-2 justify-content-end">
        <p-button label="Cancel" [text]="true" severity="secondary" (click)="ref.close(null)"/>
        <p-button label="Merge remote → local" icon="fa fa-code-merge" severity="success" (click)="ref.close('merge')"/>
        <p-button label="Reset local to remote" icon="fa fa-undo" severity="danger" (click)="ref.close('reset')"/>
      </div>
    </div>
  `,
})
export class DivergedBranchDialogComponent {
  protected ref = inject(DynamicDialogRef);
  private config = inject(DynamicDialogConfig);

  localBranch: string = this.config.data.localBranch;
  remoteBranch: string = this.config.data.remoteBranch;
}
