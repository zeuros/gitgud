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

import {ChangeDetectionStrategy, Component, inject, type OnInit} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {catchError, EMPTY, switchMap} from 'rxjs';
import {ButtonDirective} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {DynamicDialogRef} from 'primeng/dynamicdialog';
import {GitApiService} from '../../../services/git/git-api.service';
import {GitWorkflowService} from '../../../services/git-workflow.service';
import {ToastService} from '../../../services/toast.service';

@Component({
  selector: 'gitgud-add-remote-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule, ButtonDirective, InputText],
  template: `
    <form class="flex flex-column gap-3 pt-2" [formGroup]="form" (ngSubmit)="confirm()">
      <label class="flex flex-column gap-1">
        Name
        <input pInputText formControlName="remoteName"/>
      </label>
      <label class="flex flex-column gap-1">
        URL
        <input pInputText formControlName="url" placeholder="https://github.com/user/repo.git" autofocus/>
      </label>
      <div class="flex gap-2 justify-content-end">
        <button pButton type="button" text severity="secondary" (click)="cancel()">Cancel</button>
        <button pButton type="submit" [disabled]="form.invalid">Add</button>
      </div>
    </form>
  `,
})
export class AddRemoteDialogComponent implements OnInit {
  private ref = inject(DynamicDialogRef);
  private gitApi = inject(GitApiService);
  private gitWorkflow = inject(GitWorkflowService);
  private toast = inject(ToastService);

  protected form = new FormGroup({
    remoteName: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.pattern(/^\S+$/)]}),
    url: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
  });

  ngOnInit() {
    this.gitApi.git(['remote'])
      .subscribe(remoteNames => {
        if (!remoteNames.trim()) this.form.controls.remoteName.setValue('origin');
      });
  }

  protected confirm = () => {
    if (this.form.invalid) return;

    const {remoteName, url} = this.form.getRawValue();
    this.gitApi.gitAction(['remote', 'add', remoteName, url.trim()]).pipe(
      catchError(e => { this.toast.err(e); return EMPTY; }),
      // An unreachable remote is removed again, the dialog stays open to fix its URL
      switchMap(() => this.gitWorkflow.runAndRefresh(['fetch', remoteName]).pipe(
        catchError(e => {
          this.toast.err(e);
          return this.gitApi.gitAction(['remote', 'remove', remoteName]).pipe(switchMap(() => EMPTY));
        }),
      )),
    ).subscribe(() => {
      this.ref.close();
      this.toast.success(`Remote ${remoteName} added and fetched`);
    });
  };

  protected cancel = () => this.ref.close();
}
