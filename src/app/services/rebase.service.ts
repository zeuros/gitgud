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
import {catchError, defer, EMPTY, finalize, first, of, retry, Subject, switchMap, throwError} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';

@Injectable({
  providedIn: 'root',
})
export class RebaseService {

  private readonly gitApi = inject(GitApiService);
  private pendingRebase$ = new Subject<void>();

  /**
   * The flow is:
   * ```sh
   * spawn git rebase -i
   *   └─ git calls GIT_SEQUENCE_EDITOR with path to todo file
   *        └─ script polls for "$0.done" (i.e. git-rebase-todo.done)
   *             └─ blocked here until .done exists
   *
   * finishRebase(contents)
   *   ├─ writes new contents to git-rebase-todo   ← you had this
   *   └─ writes git-rebase-todo.done              ← this was missing
   *        └─ script sees the file, deletes it, exits
   *             └─ git proceeds with the rebase
   * ```
   */
  startInteractiveRebase = (sha: string, autosquash = false) => {

    // Spawn process, it should create a file with all rebase stuff
    // Store the promise so finishRebase can wait on it
    this.cleanWaitFile();
    if (this.isRebasing()) return throwError(() => new Error('Rebase is already in progress'));
    this.gitApi.spawn('git', ['rebase', '-i', ...(autosquash ? ['--autosquash'] : []), sha], {
      env: {
        ...window.electron.process.env,
        GIT_SEQUENCE_EDITOR: this.waitForFileSaveScript(),
      },
    })
      .pipe(
        finalize(() => this.pendingRebase$.next()),
        catchError(e => {
          this.pendingRebase$.error(e);
          return throwError(() => e);
        })).subscribe();

    // Wait for the file and reads the rebase file
    return defer(() => of(this.parseInteractiveRebaseOutput(window.electron.fs.readFileSync(this.rebaseFilePath())))).pipe(
      retry({count: 10, delay: 150}),
      catchError(e => this.abortRebase().pipe(switchMap(() => throwError(() => e)))),
    );
  };

  isRebasing = () => window.electron.fs.existsSync(`${this.gitApi.cwd()}/.git/rebase-merge`);

  // FIXME: if main electron process (the one calling git rebase) crashes during a git operation,
  //  git could keep a lock file, we have to write the .done and git lock file on error so that git rebase can finish and state be ok
  finishRebase = (contents: string) => {
    window.electron.fs.writeFileSync(this.rebaseFilePath(), contents);
    this.cleanWaitFile();

    return this.pendingRebase$.pipe(first());
  };

  // terminates the waitForFileSaveScript (process waiting for .done file) script and finishes the 'git rebase ...' spawned observable
  private cleanWaitFile = () => {
    try {
      window.electron.fs.writeFileSync(this.rebaseFilePath() + '.done', '');
    } catch (e) {
      console.warn(e);
    }
  };

  // TODO: make it portable, test on other platforms (e.g: windaube without git bash)
  private waitForFileSaveScript = () =>
    window.electron.process.platform === 'win32'
      ? 'sh -c "while [ ! -f \\"$0.done\\" ]; do sleep 0.3; done && rm \\"$0.done\\""' // Fixme: double check it's $0 and not $1 on git bash
      : 'sh -c \'while [ ! -f "$0.done" ]; do sleep 0.3; done && rm "$0.done"\'';

  private rebaseFilePath = () => `${this.gitApi.cwd()}/.git/rebase-merge/git-rebase-todo`;

  abortRebase = () =>
    this.gitApi.git(['rebase', '--abort']).pipe(catchError(e => {
      console.error(e);
      return EMPTY;
    }));

  private parseInteractiveRebaseOutput = (contents: string): string[] =>
    contents.split('\n')
      .map(line => line.trim())
      .filter(line => !line.startsWith('#'));

}