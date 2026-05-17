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

import {ChangeDetectionStrategy, Component, inject, type OnInit, signal} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {Button} from 'primeng/button';
import {Select} from 'primeng/select';
import {InputText} from 'primeng/inputtext';
import {DialogService, DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {GitApiService} from '../../../services/electron-cmd-parser-layer/git-api.service';
import {Observable} from 'rxjs';

export interface SetUpstreamResult {
  remote: string;
  branch: string;
}

export const openSetUpstreamDialog = (dialog: DialogService, branchName: string): Observable<SetUpstreamResult | null> =>
  dialog.open(SetUpstreamDialogComponent, {
    header: `Set upstream for "${branchName}"`,
    width: '500px',
    modal: true,
    data: {branchName},
  })!.onClose

@Component({
  selector: 'gitgud-set-upstream-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule, Button, Select, InputText],
  template: `
    <div class="flex flex-column gap-3 pt-2">
      <span>What remote/branch should <strong>"{{ branchName }}"</strong> push to and pull from?</span>
      <div class="flex align-items-center gap-2">
        <p-select
          [options]="remotes()"
          [formControl]="remoteControl"
          placeholder="remote"
          [style]="{'min-width': '8rem'}"
        />
        <span class="font-bold text-500">/</span>
        <input pInputText [formControl]="branchControl" class="flex-1"/>
      </div>
      <div class="flex gap-2 justify-content-end">
        <p-button label="Cancel" [text]="true" severity="secondary" (click)="cancel()"/>
        <p-button label="Submit" (click)="confirm()" [disabled]="!remoteControl.value || !branchControl.value"/>
      </div>
    </div>
  `,
})
export class SetUpstreamDialogComponent implements OnInit {
  private ref = inject(DynamicDialogRef<SetUpstreamResult>);
  private config = inject(DynamicDialogConfig);
  private gitApi = inject(GitApiService);

  branchName: string = this.config.data.branchName;
  remotes = signal<string[]>([]);
  remoteControl = new FormControl('', {nonNullable: true});
  branchControl = new FormControl(this.branchName, {nonNullable: true});

  ngOnInit() {
    this.gitApi.git(['remote']).subscribe(output => {
      const remotes = output.trim().split('\n').filter(Boolean);
      this.remotes.set(remotes);
      if (remotes.length) this.remoteControl.setValue(remotes[0]);
    });
  }

  confirm = () => this.ref.close({remote: this.remoteControl.value, branch: this.branchControl.value} satisfies SetUpstreamResult);
  cancel = () => this.ref.close(null);
}
