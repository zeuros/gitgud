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
      this.rebase.startInteractiveRebase(rebaseFrom).pipe(
        map(actions => mapActions(actions)),
        switchMap(actions => this.rebase.finishRebase(actions.join('\n'))),
      ),
    ).pipe(
      catchError(e => this.rebase.abortRebase().pipe(
        switchMap(() => this.gitRefresh.refreshBranchesAndLogs()),
        switchMap(() => throwError(() => e)),
      )),
      switchMap(this.gitRefresh.refreshBranchesAndLogs),
    );

  runAndRefresh = (args: (string | undefined)[], successMsg?: string, stashBefore = false, thenUnstash = true) => {
    const action$ = this.gitApi.git(args)
      .pipe(
        finalize(this.gitRefresh.doRefreshBranchesAndLogs),
        tap(() => successMsg && this.popup.success(successMsg)),
      );

    return stashBefore ? this.stash.stashAndRun(action$, thenUnstash) : action$;
  };

  doRunAndRefresh = (args: (string | undefined)[], successMsg?: string, stashBefore = false, thenUnstash = true) =>
    this.runAndRefresh(args, successMsg, stashBefore, thenUnstash).subscribe();


  rewordCommit = ({summary, description}: { summary: string, description: string }) => {
    const selectedCommitSha = this.currentRepo.selectedCommitSha()!;
    const newMessage = `${summary}\n\n${description || ''}`.trim();
    const commitIndex = this.currentRepo.selectedCommitIndex();

    // Use interactive rebase to reword a past commit
    return this.rebaseAndEditActions(`${selectedCommitSha}~1`, rewordCommitAction(this.gitApi.cwd()!, selectedCommitSha, newMessage))
      // After refreshing logs, selects the edited commit
      .pipe(tap(() => this.currentRepo.update({selectedCommitsShas: [this.currentRepo.logs()[commitIndex]?.sha]})));
  };

}