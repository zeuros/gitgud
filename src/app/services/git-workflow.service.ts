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
import {catchError, finalize, map, of, switchMap, tap, throwError} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {ToastService} from './toast.service';
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
  private toast = inject(ToastService);
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
    const action$ = this.gitApi.gitAction(args)
      .pipe(
        finalize(this.gitRefresh.doRefreshAll),
        tap(() => successMsg && this.toast.success(successMsg)),
      );

    return stashBefore ? this.stash.stashAndRun(action$, thenUnstash) : action$;
  };

  doRunAndRefresh = (args: (string | undefined)[], successMsg?: string, stashBefore = false, thenUnstash = true) =>
    this.runAndRefresh(args, successMsg, stashBefore, thenUnstash).subscribe();

  // Checks out branchName, runs args, then refreshes. Always stashes first.
  checkoutThenRun = (branchName: string, args: string[], msg?: string, thenUnstash = true) => {
    const action$ = this.gitApi.gitAction(['checkout', branchName]).pipe(
      switchMap(() => this.gitApi.gitAction(args)),
      finalize(this.gitRefresh.doRefreshAll),
      tap(() => msg && this.toast.success(msg)),
    );
    this.stash.stashAndRun(action$, thenUnstash).subscribe();
  };


  // Merges tgt into src as a merge commit without touching the working tree or index.
  // Uses git plumbing: merge-tree → commit-tree → update-ref (requires git 2.38+).
  mergeBranchInto = (source: string, target: string, msg: string) => {
    const isTargetCheckedOut = this.currentRepo.headBranch()?.name === target;

    const merge$ = this.gitApi.gitAction(['merge-tree', '--write-tree', `refs/heads/${target}`, `refs/heads/${source}`]).pipe(
      map(out => {
        const lines = out.trim().split('\n');
        const hasConflicts = lines.length > 1 && lines[1] !== '0';
        if (hasConflicts) throw new Error(`Merge conflict between ${source} and ${target}`);
        return lines[0];
      }),
      switchMap(treeSha => this.gitApi.gitAction([
        'commit-tree', treeSha,
        '-p', `refs/heads/${target}`,
        '-p', `refs/heads/${source}`,
        '-m', msg,
      ])),
      switchMap(commitSha => this.gitApi.git(['update-ref', `refs/heads/${target}`, commitSha.trim()])),
      // Sync index + working tree to the new merge commit (HEAD followed update-ref but index didn't).
      switchMap(() => isTargetCheckedOut ? this.gitApi.git(['reset', '--hard', 'HEAD']) : of(null)),
    );

    (isTargetCheckedOut ? this.stash.stashAndRun(merge$) : merge$).pipe(
      tap(() => this.toast.success(msg)),
      finalize(this.gitRefresh.doRefreshAll),
    ).subscribe();
  };

  // Rebases src onto target without touching the checked-out branch or index.
  // Uses a detached worktree to avoid the "branch already checked out" lock.
  rebaseBranchOnto = (src: string, onto: string, msg: string) => {
    const isCheckedOut = this.currentRepo.headBranch()?.name === src;
    const env = window.electron.process.env as Record<string, string>;
    const tmpPath = `${env['TMPDIR'] ?? env['TEMP'] ?? env['TMP'] ?? '/tmp'}/gitgud-rebase-${Date.now()}`;

    const rebase$ = this.gitApi.git(['worktree', 'add', '--detach', tmpPath, `refs/heads/${src}`]).pipe(
      switchMap(() => this.gitApi.git(['rebase', onto], {cwd: tmpPath}).pipe(
        catchError(e =>
          this.gitApi.git(['rebase', '--abort'], {cwd: tmpPath}).pipe(
            catchError(() => of(null)),
            switchMap(() => this.gitApi.git(['worktree', 'remove', '--force', tmpPath])),
            switchMap(() => throwError(() => e)),
          )
        ),
      )),
      switchMap(() => this.gitApi.git(['rev-parse', 'HEAD'], {cwd: tmpPath})),
      map(sha => sha.trim()),
      switchMap(newSha => this.gitApi.git(['update-ref', `refs/heads/${src}`, newSha])),
      switchMap(() => this.gitApi.git(['worktree', 'remove', tmpPath])),
      switchMap(() => isCheckedOut ? this.gitApi.git(['reset', '--hard', 'HEAD']) : of(null)),
    );

    (isCheckedOut ? this.stash.stashAndRun(rebase$) : rebase$).pipe(
      tap(() => this.toast.success(msg)),
      finalize(this.gitRefresh.doRefreshAll),
    ).subscribe();
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