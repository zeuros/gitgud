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

import {Component, inject, type OnInit} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {catchError, EMPTY, switchMap, tap} from 'rxjs';
import {Button} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {GitApiService} from '../../../services/electron-cmd-parser-layer/git-api.service';
import {GitWorkflowService} from '../../../services/git-workflow.service';
import {PopupService} from '../../../services/popup.service';

@Component({
  selector: 'gitgud-edit-remote',
  standalone: true,
  imports: [ReactiveFormsModule, Button, InputText],
  template: `
    <div class="flex flex-column gap-3 pt-2">
      <input pInputText [formControl]="urlInput" (keydown.enter)="confirm()" autofocus/>
      <div class="flex gap-2 justify-content-end">
        <p-button label="Cancel" [text]="true" severity="secondary" (click)="cancel()"/>
        <p-button label="Save" (click)="confirm()" [disabled]="!urlInput.value.length"/>
      </div>
    </div>
  `,
})
export class EditRemoteComponent implements OnInit {
  private ref = inject(DynamicDialogRef);
  private config = inject(DynamicDialogConfig);
  private gitApi = inject(GitApiService);
  private gitWorkflow = inject(GitWorkflowService);
  private popup = inject(PopupService);

  private remoteName = this.config.data.remoteName;
  protected urlInput = new FormControl('', {nonNullable: true});

  ngOnInit() {
    this.gitApi.git(['remote', 'get-url', this.remoteName])
      .subscribe(url => this.urlInput.setValue(url.trim()));
  }

  protected confirm = () =>
    this.gitApi.git(['remote', 'get-url', this.remoteName]).pipe(
      catchError(() => {
        this.popup.err(`Remote "${this.remoteName}" does not exist`);
        return EMPTY;
      }),
      switchMap(() => this.gitWorkflow.runAndRefresh(['remote', 'set-url', this.remoteName, this.urlInput.value])),
      tap(() => this.ref.close()),
      switchMap(() => this.gitWorkflow.runAndRefresh(['fetch', this.remoteName])),
      catchError(e => { this.popup.err(e); return EMPTY; }),
    ).subscribe(() => this.popup.success(`Remote ${this.remoteName} updated and reachable`));

  protected cancel = () => this.ref.close();
}
