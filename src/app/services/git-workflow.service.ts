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
import {catchError, finalize, map, switchMap, tap, throwError} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {PopupService} from './popup.service';
import {StashService} from './stash.service';
import {RebaseService} from './rebase.service';
import {GitRefreshService} from './git-refresh.service';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {rewordCommitAction} from '../utils/rebase.utils';

// High-level workflows combining services
@Injectable({
  providedIn: 'root',
})
export class GitWorkflowService {
  private gitApi = inject(GitApiService);
  private stash = inject(StashService);
  private rebase = inject(RebaseService);
  private popup = inject(PopupService);
  private gitRefresh = inject(GitRefreshService);
  private currentRepo = inject(CurrentRepoStore);

  rebaseAndEditActions = (rebaseFrom: string, mapActions: (actions: string[]) => string[], autosquash = false) =>
    this.stash.stashAndRun(
      this.rebase.startInteractiveRebase(rebaseFrom, autosquash).pipe(
        map(actions => mapActions(actions)),
        switchMap(actions => this.rebase.finishRebase(actions.join('\n'))),
      ),
    ).pipe(
      catchError(e => {
        // Conflict: git left rebase-merge in place — don't abort, refresh and let user resolve
        if (this.rebase.isRebasing()) {
          return this.gitRefresh.refreshAll().pipe(
            switchMap(() => throwError(() => e)),
          );
        }
        return this.rebase.abortRebase().pipe(
          switchMap(() => this.gitRefresh.refreshAll()),
          switchMap(() => throwError(() => e)),
        );
      }),
      switchMap(this.gitRefresh.refreshAll),
    );

  runAndRefresh = (args: (string | undefined)[], successMsg?: string, stashBefore = false, thenUnstash = true) => {
    const action$ = this.gitApi.git(args)
      .pipe(
        finalize(this.gitRefresh.doRefreshAll),
        tap(() => successMsg && this.popup.success(successMsg)),
      );

    return stashBefore ? this.stash.stashAndRun(action$, thenUnstash) : action$;
  };

  doRunAndRefresh = (args: (string | undefined)[], successMsg?: string, stashBefore = false, thenUnstash = true) =>
    this.runAndRefresh(args, successMsg, stashBefore, thenUnstash).subscribe();

  // Checks out branchName, runs args, then refreshes. Always stashes first.
  checkoutThenRun = (branchName: string, args: string[], msg?: string, thenUnstash = true) => {
    const action$ = this.gitApi.git(['checkout', branchName]).pipe(
      switchMap(() => this.gitApi.git(args)),
      finalize(this.gitRefresh.doRefreshAll),
      tap(() => msg && this.popup.success(msg)),
    );
    this.stash.stashAndRun(action$, thenUnstash).subscribe();
  };


  rewordCommit = ({summary, description}: { summary: string, description: string }) => {
    const selectedCommitSha = this.currentRepo.selectedCommitSha()!;
    const newMessage = `${summary}\n\n${description || ''}`.trim();
    const commitIndex = this.currentRepo.selectedCommitIndex();

    // Use interactive rebase to reword a past commit
    return this.rebaseAndEditActions(`${selectedCommitSha}~1`, rewordCommitAction(this.currentRepo.cwd()!, selectedCommitSha, newMessage))
      // After refreshing logs, selects the edited commit
      .pipe(tap(() => this.currentRepo.update({selectedCommitsShas: [this.currentRepo.logs()[commitIndex]?.sha]})));
  };

}