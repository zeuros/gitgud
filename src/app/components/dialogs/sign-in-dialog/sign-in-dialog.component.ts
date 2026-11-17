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

import {afterNextRender, ChangeDetectionStrategy, Component, type ElementRef, inject, type Injector, viewChild} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ButtonDirective} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {Message} from 'primeng/message';
import {DialogService, DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import type {Observable} from 'rxjs';
import type {GitCredential} from '../../../utils/git-credential.utils';

interface SignInDialogData {
  serverUrl: string;
  username?: string;
  /** Why the dialog asks again: the server rejected the previous credential */
  rejected: boolean;
}

export const openSignInDialog = (injector: Injector, data: SignInDialogData): Observable<GitCredential | null> =>
  injector.get(DialogService).open(SignInDialogComponent, {header: `Sign in to ${new URL(data.serverUrl).host}`, width: '440px', data})!.onClose;

@Component({
  selector: 'gitgud-sign-in-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonDirective, InputText, Message],
  template: `
    <form class="flex flex-column gap-3 pt-2" [formGroup]="form" (ngSubmit)="signIn()">
      @if (data.rejected) {
        <p-message severity="error" size="small">The server rejected this username or password</p-message>
      }
      <span>Git needs a username and password for <strong>{{ data.serverUrl }}</strong>.</span>
      <div class="flex flex-column gap-1">
        <label for="sign-in-username">Username</label>
        <input pInputText id="sign-in-username" formControlName="username" autocomplete="username" #usernameInput/>
      </div>
      <div class="flex flex-column gap-1">
        <label for="sign-in-password">Password or token</label>
        <input pInputText id="sign-in-password" type="password" formControlName="password" autocomplete="current-password" #passwordInput/>
        <small class="text-500">GitHub, GitLab, Bitbucket and most hosts take a personal access token here, not the account's password</small>
      </div>
      <small class="text-500">Saved in the system's keyring once the server accepts it</small>
      <div class="flex gap-2 justify-content-end">
        <button pButton type="button" text severity="secondary" (click)="cancel()">Cancel</button>
        <button pButton type="submit" [disabled]="form.invalid">Sign in</button>
      </div>
    </form>
  `,
})
export class SignInDialogComponent {
  private ref = inject(DynamicDialogRef<GitCredential | null>);
  protected data: SignInDialogData = inject(DynamicDialogConfig).data;

  protected form = new FormGroup({
    username: new FormControl(this.data.username ?? '', {nonNullable: true, validators: Validators.required}),
    password: new FormControl('', {nonNullable: true, validators: Validators.required}),
  });

  private usernameInput = viewChild.required<ElementRef<HTMLInputElement>>('usernameInput');
  private passwordInput = viewChild.required<ElementRef<HTMLInputElement>>('passwordInput');

  constructor() {
    // The first field left to fill
    afterNextRender(() => (this.form.value.username ? this.passwordInput() : this.usernameInput()).nativeElement.focus());
  }

  protected signIn = () => {
    if (this.form.valid) this.ref.close(this.form.getRawValue() satisfies GitCredential);
  };

  protected cancel = () => this.ref.close(null);
}
