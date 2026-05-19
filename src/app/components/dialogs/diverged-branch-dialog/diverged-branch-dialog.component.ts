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
import {Button} from 'primeng/button';
import {Tooltip} from 'primeng/tooltip';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';

export type DivergedBranchAction = 'reset' | 'merge' | null;

@Component({
  selector: 'gitgud-diverged-branch-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Button, Tooltip],
  template: `
    <div class="flex flex-column gap-3 pt-2">
      <span>
        Local <strong>'{{ localBranch }}'</strong> has diverged from <strong>'{{ remoteBranch }}'</strong>.
        Choose how to reconcile.
      </span>
      <div class="flex gap-2 justify-content-end">
        <p-button label="Cancel" [text]="true" severity="secondary" (click)="ref.close(null)"/>
        <p-button severity="success" (click)="ref.close('merge')"
                  pTooltip="Merges remote into local — preserves all commits but adds a merge commit." tooltipPosition="top" tooltipStyleClass="tooltip-fit-contents"
                  [autoHide]="false"
                  [autofocus]="true"
                  tooltipEvent="focus">
          <i class="fa fa-code-merge"></i>&nbsp;Merge&nbsp;<i class="fa fa-cloud"></i>&nbsp;on&nbsp;<i class="fa fa-laptop"></i>
        </p-button>
        <p-button severity="danger" (click)="ref.close('reset')"
                  pTooltip="Resets local to remote — cleaner linear history, but local commits are permanently lost." tooltipPosition="top"
                  tooltipStyleClass="tooltip-fit-contents">
          <i class="fa fa-undo"></i>&nbsp;Reset&nbsp;<i class="fa fa-laptop"></i>&nbsp;to&nbsp;<i class="fa fa-cloud"></i>
        </p-button>
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
