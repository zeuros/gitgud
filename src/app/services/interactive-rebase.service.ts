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
import {DialogService} from 'primeng/dynamicdialog';
import {EMPTY, filter, forkJoin, from, switchMap} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {GitWorkflowService} from './git-workflow.service';
import {ToastService} from './toast.service';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {notUndefined} from '../utils/utils';
import {buildRebaseTodo, parseRebaseLog, REBASE_LOG_FORMAT, type RebaseEntry, rewordMessageFile} from '../utils/interactive-rebase.utils';
import {openInteractiveRebaseDialog} from '../components/dialogs/interactive-rebase-dialog/interactive-rebase-dialog.component';

@Injectable({providedIn: 'root'})
export class InteractiveRebaseService {

  private gitApi = inject(GitApiService);
  private gitWorkflow = inject(GitWorkflowService);
  private currentRepo = inject(CurrentRepoStore);
  private dialog = inject(DialogService);
  private toast = inject(ToastService);

  /**
   * Lets the user pick what to do with HEAD's commits that aren't in `base`, then rebases them onto `base`.
   * Without base, all of HEAD's history is offered (git rebase --root).
   */
  open = (base?: string, baseLabel = base ?? 'the root') => {
    const range = base ? `${base}..HEAD` : 'HEAD';

    forkJoin({
      log: this.gitApi.git(['log', REBASE_LOG_FORMAT, '--no-merges', range]),
      mergesCount: this.gitApi.git(['rev-list', '--count', '--merges', range]),
    }).pipe(
      switchMap(({log, mergesCount}) => {
        const entries = parseRebaseLog(log);
        if (!entries.length) {
          this.toast.info(`No commit to rebase onto ${baseLabel}`);
          return EMPTY;
        }
        return openInteractiveRebaseDialog(this.dialog, {entries, onto: baseLabel, mergesCount: +mergesCount});
      }),
      filter(notUndefined),
      switchMap(entries => this.rebase(base, entries)),
    ).subscribe(() => this.toast.success(`Rebased onto ${baseLabel}`));
  };

  private rebase = (base: string | undefined, entries: RebaseEntry[]) => {
    const cwd = this.currentRepo.cwd();
    const rewordMessages = entries
      .filter(e => e.action == 'reword')
      .map(e => window.tauri.fs.writeFile(`${cwd}/${rewordMessageFile(e.sha)}`, e.message));

    // git's own todo list is replaced by ours
    return from(Promise.all(rewordMessages)).pipe(
      switchMap(() => this.gitWorkflow.rebaseAndEditActions(base ?? '--root', () => buildRebaseTodo(entries))),
    );
  };
}
