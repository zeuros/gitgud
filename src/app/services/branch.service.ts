import {inject, Injectable} from '@angular/core';
import {Branch, BranchType} from '../lib/github-desktop/model/branch';
import {catchError, finalize, switchMap} from 'rxjs';
import {ConfirmationService} from 'primeng/api';
import {normalizedBranchName} from '../utils/branch-utils';
import {PopupService} from './popup.service';
import {StashService} from './stash.service';
import {GitRefreshService} from './git-refresh.service';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {BranchAheadBehindService} from './branch-ahead-behind.service';

@Injectable({
  providedIn: 'root',
})
export class BranchService {

  private popup = inject(PopupService);
  private confirmation = inject(ConfirmationService);
  private stash = inject(StashService);
  private gitRefresh = inject(GitRefreshService);
  private gitApi = inject(GitApiService);
  private aheadBehind = inject(BranchAheadBehindService);

  checkoutBranch = (branch: Branch) => {
    const branchName = normalizedBranchName(branch);

    if (branch.isHeadPointed) {
      this.popup.warn(`Branch ${branchName} is already checked out`);
      return;
    }

    // If local branch diverged from remote, propose to reset local to remote
    const aheadBehind = this.aheadBehind.aheadBehindMap()[normalizedBranchName(branch)!]
    if (branch.type === BranchType.Remote && aheadBehind && aheadBehind.ahead + aheadBehind.behind > 0) {
      // Ask for confirm and reset hard local to remote (stash before just in case)
      // TODO: propose to re-apply the diff between local and origin after reset ?
      this.confirmation.confirm({
        header: 'Branches have diverged',
        message: `Local '${branchName}' has diverged from '${branch.name}'. Reset local to remote ? (local branch changes can be lost).`,
        acceptButtonStyleClass: 'p-button-danger',
        acceptLabel: 'Reset',
        rejectLabel: 'Cancel',
        accept: () =>
          this.stash.stashAndRun(
            this.gitApi.git(['checkout', branchName]).pipe(switchMap(() => this.gitApi.git(['reset', '--hard', `origin/${branchName}`]))),
            false,
          )
            .pipe(finalize(this.gitRefresh.doUpdateLogsAndBranches))
            .subscribe(),
      });
      return;
    }

    this.gitApi.git(['checkout', branchName]).pipe(
      // If the branch exists remotely only, we check it out and track it
      catchError(() => this.gitApi.git(['checkout', '-b', branchName, '--track', `origin/${branchName}`])),
      finalize(this.gitRefresh.doUpdateLogsAndBranches)
    ).subscribe();
  };

}
