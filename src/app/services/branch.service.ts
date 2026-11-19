import {inject, Injectable} from '@angular/core';
import type {Branch} from '../lib/github-desktop/model/branch';
import {EMPTY, finalize, switchMap} from 'rxjs';
import {localBranchOf, parseRemote, remote} from '../utils/branch-utils';
import {StashService} from './stash.service';
import {GitRefreshService} from './git-refresh.service';
import {GitApiService} from './git/git-api.service';
import {BranchAheadBehindService} from './branch-ahead-behind.service';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {GitRepositoryService} from './git-repository.service';
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
  private currentRepo = inject(CurrentRepoStore);
  private gitRepository = inject(GitRepositoryService);

  checkoutBranch = (branch: Branch) => {
    const localBranch = remote(branch) ? localBranchOf(branch, this.currentRepo.branches()) : branch;
    const branchName = localBranch?.name ?? parseRemote(branch.name).branch;

    // Checked out in another worktree (git refuses to check it out twice): work there instead
    const worktree = this.currentRepo.otherWorktreeOf(branchName);
    if (worktree) {
      this.gitRepository.switchWorktree(worktree).subscribe();
      return;
    }

    // If local branch diverged from remote, let user choose reset, merge or cancel
    const aheadBehind = this.aheadBehind.aheadBehindMap()[branchName];
    if (remote(branch) && localBranch?.upstream === branch.name && aheadBehind && aheadBehind.ahead + aheadBehind.behind > 0) {
      this.dialog.open(DivergedBranchDialogComponent, {
        header: 'Branches have diverged',
        width: '480px',
        data: {localBranch: branchName, remoteBranch: branch.name},
      })!.onClose.pipe(
        switchMap((action: DivergedBranchAction) => {
          if (action === 'reset') {
            return this.stash.stashAndRun(
              this.gitApi.gitAction(['checkout', branchName]).pipe(
                switchMap(() => this.gitApi.gitAction(['reset', '--hard', branch.name])),
              ), false,
            );
          }
          if (action === 'merge') {
            return this.stash.stashAndRun(
              this.gitApi.gitAction(['checkout', branchName]).pipe(
                switchMap(() => this.gitApi.gitAction(['merge', branch.name])),
              ),
            );
          }
          return EMPTY;
        }),
        finalize(this.gitRefresh.doUpdateLogsAndBranches),
      ).subscribe();
      return;
    }

    // A remote branch with no local one: create it, tracking the remote branch
    const checkoutArgs = localBranch ? ['checkout', branchName] : ['checkout', '-b', branchName, '--track', branch.name];
    this.gitApi.gitAction(checkoutArgs).pipe(
      finalize(this.gitRefresh.doUpdateLogsAndBranches),
    ).subscribe();
  };
}
