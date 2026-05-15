import {inject, Injectable} from '@angular/core';
import {Branch, BranchType} from '../lib/github-desktop/model/branch';
import {catchError, EMPTY, finalize, switchMap} from 'rxjs';
import {normalizedBranchName} from '../utils/branch-utils';
import {StashService} from './stash.service';
import {GitRefreshService} from './git-refresh.service';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {BranchAheadBehindService} from './branch-ahead-behind.service';
import {DialogService} from 'primeng/dynamicdialog';
import {type DivergedBranchAction, DivergedBranchDialogComponent} from '../components/dialogs/diverged-branch-dialog/diverged-branch-dialog.component';

@Injectable({
  providedIn: 'root',
})
export class BranchService {

  private dialog = inject(DialogService);
  private stash = inject(StashService);
  private gitRefresh = inject(GitRefreshService);
  private gitApi = inject(GitApiService);
  private aheadBehind = inject(BranchAheadBehindService);

  checkoutBranch = (branch: Branch) => {
    const branchName = normalizedBranchName(branch);

    // If local branch diverged from remote, let user choose reset, merge or cancel
    const aheadBehind = this.aheadBehind.aheadBehindMap()[normalizedBranchName(branch)!];
    if (branch.type === BranchType.Remote && aheadBehind && aheadBehind.ahead + aheadBehind.behind > 0) {
      this.dialog.open(DivergedBranchDialogComponent, {
        header: 'Branches have diverged',
        width: '480px',
        modal: true,
        data: {localBranch: branchName, remoteBranch: branch.name},
      })?.onClose.pipe(
        switchMap((action: DivergedBranchAction) => {
          if (action === 'reset') {
            return this.stash.stashAndRun(
              this.gitApi.gitAction(['checkout', branchName]).pipe(
                switchMap(() => this.gitApi.gitAction(['reset', '--hard', `origin/${branchName}`])),
              ), false,
            );
          }
          if (action === 'merge') {
            return this.stash.stashAndRun(
              this.gitApi.gitAction(['checkout', branchName]).pipe(
                switchMap(() => this.gitApi.gitAction(['merge', `origin/${branchName}`])),
              ),
            );
          }
          return EMPTY;
        }),
        finalize(this.gitRefresh.doUpdateLogsAndBranches),
      ).subscribe();
      return;
    }

    // If the branch exists remotely only, check it out and track it
    this.gitApi.gitAction(['checkout', branchName]).pipe(
      catchError(() => this.gitApi.gitAction(['checkout', '-b', branchName, '--track', `origin/${branchName}`])),
      finalize(this.gitRefresh.doUpdateLogsAndBranches),
    ).subscribe();
  };

}
