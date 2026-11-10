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

import {inject, Injectable} from '@angular/core';
import {catchError, defer, EMPTY, finalize, first, from, map, type Observable, retry, Subject, switchMap, throwError} from 'rxjs';
import {GitApiService, noopEditor} from './git/git-api.service';

@Injectable({
  providedIn: 'root',
})
export class RebaseService {

  private gitApi = inject(GitApiService);
  private pendingRebase$ = new Subject<void>();

  /**
   * The flow is:
   * ```sh
   * spawn git rebase -i
   *   └─ git calls GIT_SEQUENCE_EDITOR with path to todo file
   *        └─ script polls for "$0.done" or "$0.abort" (i.e. git-rebase-todo.done)
   *             └─ blocked here until one exists
   *
   * finishRebase(contents)
   *   ├─ writes new contents to git-rebase-todo
   *   └─ writes git-rebase-todo.done
   *        └─ script sees the file, deletes it, exits
   *             └─ git proceeds with the rebase
   *   or, if a write fails, writes git-rebase-todo.abort
   *        └─ script exits 1: git cancels the rebase and removes its state
   * ```
   */
  startInteractiveRebase = (sha: string, autosquash = false) =>
    defer(() => from(this.hasRebaseFile())).pipe(
      switchMap(isRebasing => {
        if (isRebasing) throw new Error('Rebase is already in progress');
        this.spawnRebaseProcess(sha, autosquash);
        return this.readRebaseActionsFile();
      }),
    );

  // Spawn a git rebase process, it should create a file with all rebase actions and wait for user input
  // Once rebase actions file is created, we next pendingRebase$ finishRebase can change actions and ... finish the rebase
  private spawnRebaseProcess = (sha: string, autosquash: boolean) => {
    // --empty=drop: a commit emptied by the rebase would otherwise stop it. GIT_EDITOR: squash keeps both messages as is
    this.gitApi.spawn('git', ['rebase', '-i', '--empty=drop', ...(autosquash ? ['--autosquash'] : []), sha], {
      env: {GIT_SEQUENCE_EDITOR: this.waitForFileSaveScript(), GIT_EDITOR: noopEditor()},
    }).pipe(
      catchError(e => {
        this.pendingRebase$.error(e);
        return throwError(() => e);
      }),
      finalize(() => this.pendingRebase$.next()),
    ).subscribe();
  };

  private readRebaseActionsFile = (): Observable<string[]> =>
    defer(() => from(this.rebaseActionsFilePath().then(window.tauri.fs.readFile)).pipe(
      map(contents => this.parseInteractiveRebaseOutput(contents)),
    )).pipe(
      retry({count: 10, delay: 150}),
      catchError(e => this.abortRebase().pipe(switchMap(() => throwError(() => e)))),
    );

  // FIXME: if the app dies while git rebase waits for the todo list, git can keep its lock file:
  //  writing the .done file and removing the lock on error would let the rebase finish in a clean state
  finishRebase = (contents: string) => {
    // Fire-and-forget writes; the pending rebase observable waits for the .done signal
    // The todo is written before .done appears: git reads it as soon as the editor script exits
    this.rebaseActionsFilePath()
      .then(path => window.tauri.fs.writeFile(path, contents))
      .then(() => this.signalWaitScript('done'))
      // Otherwise git waits forever: cancel the rebase, then report why
      .catch((error: unknown) => this.signalWaitScript('abort').then(() => Promise.reject(error), () => Promise.reject(error)));
    return this.pendingRebase$.pipe(first());
  };

  // Ends waitForFileSaveScript: on 'done' git runs the todo list, on 'abort' it cancels the rebase
  private signalWaitScript = (signal: 'done' | 'abort') =>
    this.rebaseActionsFilePath().then(path => window.tauri.fs.writeFile(`${path}.${signal}`, ''));

  // Git runs it as `<editor> <todo file>`, so the file is $0 of `sh -c`. On Windows, sh comes with Git for Windows (untested without it)
  private waitForFileSaveScript = () =>
    window.tauri.process.platform === 'win32'
      ? 'sh -c "until [ -f \\"$0.done\\" ] || [ -f \\"$0.abort\\" ]; do sleep 0.3; done; [ -f \\"$0.done\\" ] && rm \\"$0.done\\""'
      : 'sh -c \'until [ -f "$0.done" ] || [ -f "$0.abort" ]; do sleep 0.3; done; [ -f "$0.done" ] && rm "$0.done"\'';

  hasRebaseFile = () => this.gitApi.gitPath('rebase-merge').then(window.tauri.fs.exists);

  private rebaseActionsFilePath = () => this.gitApi.gitPath('rebase-merge/git-rebase-todo');

  abortRebase = () =>
    this.gitApi.gitAction(['rebase', '--abort']).pipe(
      catchError(e => {
        console.error(e);
        return EMPTY;
      }),
    );

  private parseInteractiveRebaseOutput = (contents: string): string[] =>
    contents.split('\n')
      .map(line => line.trim())
      .filter(line => !line.startsWith('#'));

}