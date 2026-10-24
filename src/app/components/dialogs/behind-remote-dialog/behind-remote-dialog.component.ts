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
import {type DialogService, DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import type {Observable} from 'rxjs';
import {worktreeName} from '../../../utils/worktree-utils';

export type BehindRemoteAction = 'pull' | 'merge' | 'rebase' | 'force-push' | null;

interface BehindRemoteData {
  localRef: string;
  remoteRef: string;
  diverged: boolean;
  otherWorktreeName?: string;
}

export const openBehindRemoteDialog = (
  dialog: DialogService,
  localRef: string,
  remoteRef: string,
  diverged: boolean,
  // Worktree that has localRef checked out: git can't pull, rebase or merge into it from here
  otherWorktreePath?: string,
): Observable<BehindRemoteAction> =>
  dialog.open<BehindRemoteDialogComponent, BehindRemoteData>(BehindRemoteDialogComponent, {
    header: diverged ? 'Branches have diverged' : 'Branch is behind remote',
    width: '600px',
    data: {localRef, remoteRef, diverged, otherWorktreeName: otherWorktreePath && worktreeName(otherWorktreePath)},
  })!.onClose;

@Component({
  selector: 'gitgud-behind-remote-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Button],
  template: `
    <div class="flex flex-column gap-3 pt-2">
      @if (data.diverged) {
        <span>
          <strong>'{{ data.localRef }}'</strong> has diverged from <strong>'{{ data.remoteRef }}'</strong>.
          Choose how to reconcile before pushing.
        </span>
        @if (data.otherWorktreeName) {
          <span>It's checked out in worktree <strong>{{ data.otherWorktreeName }}</strong>: switch to it to rebase or merge.</span>
        }
        <div class="flex gap-2 justify-content-end">
          <p-button label="Cancel" [text]="true" severity="secondary" (click)="ref.close(null)"/>
          <p-button label="Force Push" severity="danger" (click)="ref.close('force-push')"/>
          <p-button label="Rebase" severity="secondary" [disabled]="!!data.otherWorktreeName" (click)="ref.close('rebase')"/>
          <p-button label="Merge" severity="success" [disabled]="!!data.otherWorktreeName" (click)="ref.close('merge')"/>
        </div>
      } @else {
        <span>
          <strong>'{{ data.localRef }}'</strong> is behind <strong>'{{ data.remoteRef }}'</strong>.
          Update your branch by doing a Pull.
        </span>
        @if (data.otherWorktreeName) {
          <span>It's checked out in worktree <strong>{{ data.otherWorktreeName }}</strong>: switch to it to pull.</span>
        }
        <div class="flex gap-2 justify-content-end">
          <p-button label="Cancel" [text]="true" severity="secondary" (click)="ref.close(null)"/>
          <p-button label="Force Push" severity="danger" (click)="ref.close('force-push')"/>
          <p-button label="Pull (fast-forward if possible)" severity="success" [disabled]="!!data.otherWorktreeName" (click)="ref.close('pull')"/>
        </div>
      }
    </div>
  `,
})
export class BehindRemoteDialogComponent {
  protected ref = inject(DynamicDialogRef);
  protected data = inject<DynamicDialogConfig<BehindRemoteData>>(DynamicDialogConfig).data!;
}
