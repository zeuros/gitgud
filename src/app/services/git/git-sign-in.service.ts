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

import {inject, Injectable, Injector} from '@angular/core';
import {catchError, finalize, from, type Observable, shareReplay, switchMap, take, throwError} from 'rxjs';
import {type AuthenticationFailure, authenticationFailure, credentialEnv, type GitCredential} from '../../utils/git-credential.utils';

/**
 * Asks for the credential of an HTTPS server git failed to authenticate to, and runs the git command again with it.
 *
 * GitGud's credential helper (src-tauri/src/credential_helper.rs) hands git the credential of the dialog, git saves it
 * in the keyring once the server accepts it, and deletes the saved one the server rejects: a credential that stops
 * working (a token expired or revoked) makes git fail again, and the dialog asks again. A server refusing a credential
 * it accepted (HTTP 403, e.g. a read-only token used to push) asks for another one too, which replaces it once it works.
 */
@Injectable({providedIn: 'root'})
export class GitSignInService {

  private injector = inject(Injector);

  // One dialog per server: git commands failing together (a fetch and a push…) wait for the same answer
  private openDialogs = new Map<string, Observable<GitCredential | null>>();

  /**
   * Runs `command` with no extra environment; when git fails to authenticate, asks for a credential and runs it
   * again with the environment handing it to git, until it works or the user cancels
   */
  withSignIn = <T>(command: (env?: Record<string, string>) => Observable<T>): Observable<T> =>
    command().pipe(catchError(error => this.signInAndRetry(error, command)));

  // `rejected`: the credential the server just rejected, asked for again
  private signInAndRetry = <T>(error: unknown, command: (env?: Record<string, string>) => Observable<T>, rejected?: GitCredential): Observable<T> => {
    const failure = authenticationFailure(error);
    if (!failure) return throwError(() => error);
    const reason = failure.forbidden ? 'forbidden' : rejected ? 'rejected' : undefined;
    return this.askCredential({...failure, username: failure.username ?? rejected?.username}, reason).pipe(
      switchMap(credential => {
        if (!credential) return throwError(() => new Error(`Sign-in to ${new URL(failure.serverUrl).host} cancelled`));
        return command(credentialEnv(failure.serverUrl, credential)).pipe(
          catchError(retryError => this.signInAndRetry(retryError, command, credential)),
        );
      }),
    );
  };

  private askCredential = ({serverUrl, username}: AuthenticationFailure, reason?: 'rejected' | 'forbidden') => {
    let credential$ = this.openDialogs.get(serverUrl);
    if (!credential$) {
      // onClose is a Subject that doesn't complete: take its answer, then forget the dialog
      // Loaded when needed: GitApiService, which every git call goes through, doesn't pull the dialog and PrimeNG in
      credential$ = from(import('../../components/dialogs/sign-in-dialog/sign-in-dialog.component')).pipe(
        switchMap(({openSignInDialog}) => openSignInDialog(this.injector, {serverUrl, username, ...(reason ? {reason} : {})})),
        take(1),
        finalize(() => this.openDialogs.delete(serverUrl)),
        shareReplay({bufferSize: 1, refCount: false}),
      );
      this.openDialogs.set(serverUrl, credential$);
    }
    return credential$;
  };
}
