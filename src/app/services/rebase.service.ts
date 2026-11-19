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
import {catchError, defer, EMPTY, from, map, of, switchMap, throwError} from 'rxjs';
import {GitApiService, NOOP_EDITOR} from './git/git-api.service';

// What GitGud's sequence editor does with git's todo file (src-tauri/src/sequence_editor.rs)
const COPY_REBASE_TODO_TO = 'GITGUD_COPY_REBASE_TODO_TO';
const MOVE_REBASE_TODO_FROM = 'GITGUD_MOVE_REBASE_TODO_FROM';

@Injectable({
  providedIn: 'root',
})
export class RebaseService {

  private gitApi = inject(GitApiService);

  /**
   * The flow is:
   * ```text
   * readRebaseActionsSequenceThenCancel():
   *   main GitGud spawns git rebase -i,
   *   GitGud's own binary as GIT_SEQUENCE_EDITOR (src-tauri/src/sequence_editor.rs)
   *   └─ git writes git-rebase-todo, calls GIT_SEQUENCE_EDITOR with its path
   *      └─ GitGud's sequence editor copies the sequence
   *         to GITGUD_COPY_REBASE_TODO_TO and exits 1
   *         └─ git cancels the rebase (exit 0 would run git's sequence),
   *            main GitGud reads the sequence from the copy
   *
   * editSequence(sequence):
   *   main GitGud edits the sequence
   *
   * runRebaseTodo():
   *   main GitGud writes the sequence to GITGUD_MOVE_REBASE_TODO_FROM,
   *   spawns git rebase -i again
   *   └─ git writes git-rebase-todo, calls GIT_SEQUENCE_EDITOR with its path
   *      └─ GitGud's sequence editor moves the new sequence
   *         over git-rebase-todo and exits 0
   *         └─ git finishes the rebase with the new sequence
   * ```
   */
  interactiveRebase = (sha: string, editSequence: (sequence: string[]) => string[], autosquash = false) =>
    defer(() => from(this.hasRebaseFile())).pipe(
      switchMap(isRebasing => {
        if (isRebasing) throw new Error('Rebase is already in progress');
        return this.readRebaseActionsSequenceThenCancel(sha, autosquash);
      }),
      switchMap(sequence => this.runRebaseTodo(sha, autosquash, editSequence(sequence).join('\n'))),
    );

  // Get git's todo list (sequence), from a rebase cancelled before it replays any commit.
  // Asks git for its sequence (keeping --autosquash's order); the editor exits 1, as exit 0 would run it: git failing is expected.
  // GITGUD_COPY_REBASE_TODO_TO (.git/gitgud-rebase-todo) is emptied first: if it stays empty, the editor never ran, and git's error (or unexpected success) is reported
  private readRebaseActionsSequenceThenCancel = (sha: string, autosquash: boolean) =>
    defer(() => from(this.rebaseTodoCopyPath().then(path => window.tauri.fs.writeFile(path, '').then(() => path)))).pipe(
      switchMap(path => this.spawnRebase(sha, autosquash, {[COPY_REBASE_TODO_TO]: path}).pipe(
        map((): unknown => new Error('git rebase ran without calling the sequence editor')),
        catchError((error: unknown) => of(error)),
        switchMap(error => from(window.tauri.fs.readFile(path)).pipe(
          switchMap(contents => contents.trim() ? of(this.parseRebaseTodo(contents)) : throwError(() => error)),
        )),
      )),
    );

  private runRebaseTodo = (sha: string, autosquash: boolean, sequence: string) =>
    defer(() => from(this.rebaseTodoCopyPath().then(path => window.tauri.fs.writeFile(path, sequence).then(() => path)))).pipe(
      switchMap(path => this.spawnRebase(sha, autosquash, {[MOVE_REBASE_TODO_FROM]: path})),
    );

  // --empty=drop: a commit emptied by the rebase would otherwise stop it. GIT_EDITOR: squash keeps both messages as is
  private spawnRebase = (sha: string, autosquash: boolean, env: Record<string, string>) =>
    this.gitApi.spawn('git', ['rebase', '-i', '--empty=drop', ...(autosquash ? ['--autosquash'] : []), sha], {
      env: {GIT_EDITOR: NOOP_EDITOR, GIT_SEQUENCE_EDITOR: window.tauri.process.env['GITGUD_BINARY_NAME'], ...env},
    });

  private rebaseTodoCopyPath = () => this.gitApi.gitPath('gitgud-rebase-todo');

  hasRebaseFile = () => this.gitApi.gitPath('rebase-merge').then(window.tauri.fs.exists);

  abortRebase = () =>
    this.gitApi.gitAction(['rebase', '--abort']).pipe(
      catchError(e => {
        console.error(e);
        return EMPTY;
      }),
    );

  private parseRebaseTodo = (contents: string) =>
    contents.split('\n')
      .map(line => line.trim())
      .filter(line => !line.startsWith('#'));

}