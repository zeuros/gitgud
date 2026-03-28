import {inject, Injectable} from '@angular/core';
import {finalize, map, switchMap, tap} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {PopupService} from './popup.service';
import {StashService} from './stash.service';
import {RebaseService} from './rebase.service';
import {GitRefreshService} from './git-refresh.service';
import {GitRepositoryStore} from '../stores/git-repos.store';

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
  private gitRepositoryStore = inject(GitRepositoryStore);

  rebaseAndEditActions = (rebaseFrom: string, mapActions: (actions: string[]) => string[], autosquash = false) =>
    this.stash.stashAndRun(
      this.rebase.startInteractiveRebase(rebaseFrom).pipe(
        map(actions => mapActions(actions)),
        switchMap(actions => this.rebase.finishRebase(actions.join('\n'))),
      ),
    ).pipe(finalize(this.gitRefresh.doRefreshBranchesAndLogs));

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

}