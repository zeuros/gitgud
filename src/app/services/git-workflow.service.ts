import {inject, Injectable} from '@angular/core';
import {finalize, map, switchMap, tap} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {WorkingDirectoryService} from './electron-cmd-parser-layer/working-directory.service';
import {GitRepositoryService} from './git-repository.service';
import {PopupService} from './popup.service';
import {StashService} from './stash.service';
import {RebaseService} from './rebase.service';

// High-level workflows combining services
@Injectable({
  providedIn: 'root',
})
export class GitWorkflowService {
  private readonly gitApi = inject(GitApiService);
  private readonly stash = inject(StashService);
  private readonly rebase = inject(RebaseService);
  private readonly workingDirectory = inject(WorkingDirectoryService);
  private readonly gitRepository = inject(GitRepositoryService);
  private readonly popup = inject(PopupService);


  rebaseAndRun = (rebaseFrom: string, mapActions: (actions: string[]) => string[], autosquash = false) =>
    this.stash.stashAndRun(
      this.rebase.startInteractiveRebase(rebaseFrom).pipe(
        map(actions => mapActions(actions)),
        switchMap(actions => this.rebase.finishRebase(actions.join('\n'))),
      ),
    ).pipe(finalize(this.refreshBranchesAndLogs));

  runAndRefresh = (args: (string | undefined)[], successMsg?: string, stashBefore = false, thenUnstash = true) => {
    const action$ = this.gitApi.git(args)
      .pipe(
        finalize(this.refreshBranchesAndLogs),
        tap(() => successMsg && this.popup.success(successMsg)),
      );

    return stashBefore ? this.stash.stashAndRun(action$, thenUnstash) : action$;
  };

  doRunAndRefresh = (args: (string | undefined)[], successMsg?: string, stashBefore = false, thenUnstash = true) =>
    this.runAndRefresh(args, successMsg, stashBefore, thenUnstash).subscribe();

  refreshBranchesAndLogs = () => this.workingDirectory.doFetchWorkingDirChanges() && this.gitRepository.doUpdateLogsAndBranches();

}