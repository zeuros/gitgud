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
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';

export type BehindRemoteAction = 'pull' | 'merge' | 'rebase' | 'force-push' | null;

@Component({
  selector: 'gitgud-behind-remote-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Button],
  template: `
    <div class="flex flex-column gap-3 pt-2">
      @if (diverged) {
        <span>
          <strong>'{{ localRef }}'</strong> has diverged from <strong>'{{ remoteRef }}'</strong>.
          Choose how to reconcile before pushing.
        </span>
        <div class="flex gap-2 justify-content-end">
          <p-button label="Cancel" [text]="true" severity="secondary" (click)="ref.close(null)"/>
          <p-button label="Force Push" severity="danger" (click)="ref.close('force-push')"/>
          <p-button label="Rebase" severity="secondary" (click)="ref.close('rebase')"/>
          <p-button label="Merge" severity="success" (click)="ref.close('merge')"/>
        </div>
      } @else {
        <span>
          <strong>'{{ localRef }}'</strong> is behind <strong>'{{ remoteRef }}'</strong>.
          Update your branch by doing a Pull.
        </span>
        <div class="flex gap-2 justify-content-end">
          <p-button label="Cancel" [text]="true" severity="secondary" (click)="ref.close(null)"/>
          <p-button label="Force Push" severity="danger" (click)="ref.close('force-push')"/>
          <p-button label="Pull (fast-forward if possible)" severity="success" (click)="ref.close('pull')"/>
        </div>
      }
    </div>
  `,
})
export class BehindRemoteDialogComponent {
  protected ref = inject(DynamicDialogRef);
  private config = inject(DynamicDialogConfig);

  localRef: string = this.config.data.localRef;
  remoteRef: string = this.config.data.remoteRef;
  diverged: boolean = this.config.data.diverged;
}
