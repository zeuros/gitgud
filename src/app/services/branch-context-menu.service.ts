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

import {computed, effect, inject, Injectable, signal, untracked} from '@angular/core';
import {ConfirmationService, type MenuItem, type TreeNode} from 'primeng/api';
import {catchError, EMPTY, filter, first, switchMap, throwError} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {Branch, BranchType} from '../lib/github-desktop/model/branch';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {notUndefined} from '../utils/utils';
import {GitWorkflowService} from './git-workflow.service';
import {ToastService} from './toast.service';
import {PromptService} from './prompt.service';
import {DialogService} from 'primeng/dynamicdialog';
import {EditRemoteComponent} from '../components/dialogs/edit-remote/edit-remote.component';
import {openSetUpstreamDialog} from '../components/dialogs/set-upstream-dialog/set-upstream-dialog.component';
import {CreateBranchService} from './create-branch.service';
import {parseRemote} from '../utils/branch-utils';
import {BranchService} from './branch.service';
import {CreateTagService} from './create-tag.service';
import {BranchAheadBehindService} from './branch-ahead-behind.service';
import {InteractiveRebaseService} from './interactive-rebase.service';
import {ConflictPredictionService} from './conflict-prediction.service';
import {withConflictWarning} from '../utils/conflict-prediction.utils';
import {type BehindRemoteAction, openBehindRemoteDialog} from '../components/dialogs/behind-remote-dialog/behind-remote-dialog.component';

@Injectable({providedIn: 'root'})
export class BranchContextMenuService {

  private currentRepo = inject(CurrentRepoStore);
  private gitApi = inject(GitApiService);
  private toast = inject(ToastService);
  private confirmation = inject(ConfirmationService);
  private branch = inject(BranchService);
  private gitWorkflow = inject(GitWorkflowService);
  private prompt = inject(PromptService);
  private dialog = inject(DialogService);
  private createBranch = inject(CreateBranchService);
  private createTag = inject(CreateTagService);
  private aheadBehind = inject(BranchAheadBehindService);
  private interactiveRebase = inject(InteractiveRebaseService);
  private conflictPrediction = inject(ConflictPredictionService);

  selectedNode = signal<TreeNode<Branch> | undefined>(undefined);

  selectBranch = (branch: Branch) => this.selectedNode.set({data: branch, label: branch.name});

  constructor() {
    // Would the selected branch conflict with HEAD? The menu is updated once git answered
    effect(() => {
      const tip = this.selectedNode()?.data?.tip.sha;
      untracked(() => this.conflictPrediction.predictForMenu(this.currentRepo.headSha(), tip, this.branchContextMenu));
    });
  }

  private name = computed(() => this.selectedNode()?.data?.name ?? '…');
  private head = computed(() => this.currentRepo.headBranch()?.name ?? 'HEAD');

  private countLeaves = (node: TreeNode<Branch>): number =>
    node.children?.length ? node.children.reduce((n, c) => n + this.countLeaves(c), 0) : 1;

  branchContextMenu = computed<MenuItem[]>(() => {
    const node = this.selectedNode();
    if (!node) return [];

    if (node.type === 'remote-root') {
      const remoteName = node.label ?? '…';
      return [{label: `Edit ${remoteName}`, icon: 'fa fa-pencil', command: () => this.editRemote(remoteName)}];
    }

    if (node.children?.length) {
      const label = node.label ?? '…';
      const count = this.countLeaves(node);
      return [{label: `Remove ${count} branches in ${label}`, icon: 'fa fa-trash', command: () => this.toast.info(`Remove ${count} branches in ${label}`)}];
    }

    const name = this.name();
    const head = this.head();
    const warn = (item: MenuItem) => withConflictWarning(item, this.conflictPrediction.conflictsBetween(this.currentRepo.headSha(), node.data?.tip.sha));
    return [
      // Remote
      {label: 'Pull (fast-forward if possible)', icon: 'fa fa-cloud-download', command: this.pullBranch},
      {label: 'Push', icon: 'fa fa-cloud-upload', command: this.pushBranch},
      {label: 'Set Upstream', icon: 'fa fa-link', command: this.setUpstream},
      {separator: true},
      // Integration
      warn({label: `Merge ${name} into ${head}`, icon: 'fa fa-compress', command: this.mergeBranch}),
      warn({label: `Rebase ${head} onto ${name}`, icon: 'fa fa-code-fork', command: this.rebaseBranch}),
      warn({label: `Interactive Rebase ${head} onto ${name}`, icon: 'fa fa-list-ol', command: () => this.interactiveRebase.open(name)}),
      {separator: true},
      // Checkout
      {label: `Checkout ${name}`, icon: 'fa fa-sign-in', command: () => node.data && this.branch.checkoutBranch(node.data)},
      {separator: true},
      // Commit ops
      {label: 'Create branch here', icon: 'fa fa-plus', command: this.createBranchHere},
      {
        label: `Reset ${head} to this commit`,
        icon: 'fa fa-history',
        items: [
          {
            label: 'Soft — Undo commits, keep changes staged',
            command: () => this.resetBranch('soft'),
            tooltipOptions: {tooltipLabel: 'All commits between this commit and HEAD are uncommitted, their changes are put staged in working directory', tooltipPosition: 'right'},
          },
          {
            label: 'Mixed — Undo commits, keep changes in files',
            command: () => this.resetBranch('mixed'),
            tooltipOptions: {tooltipLabel: 'All commits between this commit and HEAD are uncommitted, their changes are put unstaged in working directory', tooltipPosition: 'right'},
          },
          {
            label: 'Hard — discard commits changes',
            command: () => this.resetBranch('hard'),
            tooltipOptions: {tooltipLabel: 'All commits between this commit and HEAD are discarded', tooltipPosition: 'right'},
          },
        ],
      },
      {separator: true},
      // Branch management
      {label: `Rename ${name}`, icon: 'fa fa-pencil', command: this.renameBranch},
      {label: `Delete ${name}`, icon: 'fa fa-trash', command: this.deleteBranch},
      {separator: true},
      // Copy
      {label: 'Copy branch name', icon: 'fa fa-copy', command: () => navigator.clipboard.writeText(name)},
      {label: 'Copy commit SHA', icon: 'fa fa-copy', command: () => navigator.clipboard.writeText(node.data?.tip.sha ?? '')},
      {separator: true},
      // Tags
      {label: 'Create tag here', icon: 'fa fa-tag', command: this.createTagHere},
    ];
  });

  private pullBranch = () =>
    this.gitWorkflow.doRunAndRefresh(['fetch', 'origin', `${this.name()}:${this.name()}`], `Pulled ${this.name()}`);

  private pushBranch = () => {
    const name = this.name();
    const ab = this.aheadBehind.aheadBehindMap()[name];
    if (!ab?.behind) {
      this.gitWorkflow.doRunAndRefresh(['push', 'origin', name], `Pushed ${name}`);
      return;
    }
    const diverged = ab.ahead > 0;
    openBehindRemoteDialog(this.dialog, name, `origin/${name}`, diverged)
      .subscribe((action: BehindRemoteAction) => {
        if (action === 'force-push') this.gitWorkflow.doRunAndRefresh(['push', '--force-with-lease', 'origin', name], `Force-pushed ${name}`);
        if (action === 'pull')       this.gitWorkflow.doRunAndRefresh(['fetch', 'origin', `${name}:${name}`], `Pulled ${name}`);
        if (action === 'rebase')     this.gitWorkflow.rebaseBranchOnto(name, `origin/${name}`, `Rebased ${name} onto origin/${name}`);
        if (action === 'merge')      this.gitWorkflow.checkoutThenRun(name, ['merge', '--no-ff', `origin/${name}`], `Merged origin/${name} into ${name}`);
      });
  };

  private setUpstream = () =>
    openSetUpstreamDialog(this.dialog, this.name())
      .pipe(first(notUndefined))
      .subscribe(({remote, branch}) => this.gitWorkflow.doRunAndRefresh(['branch', `--set-upstream-to=${remote}/${branch}`, this.name()], `Upstream set to ${remote}/${branch}`));


  private mergeBranch = () =>
    this.gitWorkflow.doRunAndRefresh(['merge', this.name()], `Merged ${this.name()} into ${this.head()}`, true, true);

  private rebaseBranch = () =>
    this.gitWorkflow.rebaseBranchOnto(this.head(), this.name(), `Rebased ${this.head()} onto ${this.name()}`);

  private createBranchHere = () => this.createBranch.createBranchAtSha(this.selectedNode()!.data!.tip!.sha!);

  private resetBranch = (mode: 'soft' | 'mixed' | 'hard') =>
    this.gitWorkflow.doRunAndRefresh(['reset', `--${mode}`, this.name()], `Reset ${mode} to ${this.name()}`, mode === 'hard', false);

  private renameBranch = () =>
    this.prompt.open(`New name for ${this.name()}:`, true, this.name())
      .pipe(first(notUndefined), filter(newName => newName != this.name()))
      .subscribe(newName => this.gitWorkflow.doRunAndRefresh(['branch', '-m', this.name(), newName], `Renamed ${this.name()} to ${newName}`));

  private deleteBranch = () => {
    const branch = this.selectedNode()!.data!;

    if (branch.type === BranchType.Remote) {
      const {remote, branch: name} = parseRemote(branch.name);
      this.gitWorkflow.runAndRefresh(['push', remote, '--delete', name], `Deleted remote branch ${branch.name}`, false, false)
        // Failed because it's already deleted on the remote? Then only our stale copy of it is left to remove
        .pipe(catchError(e => this.gitApi.git(['ls-remote', '--heads', remote, `refs/heads/${name}`]).pipe(
          catchError(() => throwError(() => e)),
          switchMap(found => found.trim()
            ? throwError(() => e)
            : this.gitWorkflow.runAndRefresh(['branch', '-d', '-r', branch.name], `Removed ${branch.name}, already deleted on ${remote}`, false, false)),
        )))
        .subscribe();
      return;
    }

    this.gitWorkflow.runAndRefresh(['branch', '-d', branch.name], `Deleted branch ${branch.name}`, false, false)
      .pipe(
        catchError(() => {
          this.confirmation.confirm({
            header: `Force-delete ${branch.name} ?`,
            message: `Any commits only reachable through this branch will be permanently lost.`,
            acceptButtonStyleClass: 'p-button-danger',
            acceptLabel: 'Force Delete',
            rejectLabel: 'Cancel',
            accept: () => this.gitWorkflow.doRunAndRefresh(['branch', '-D', branch.name], `Force-deleted branch ${branch.name}`, false, false),
          });
          return EMPTY;
        }),
      )
      .subscribe();
  };

  private createTagHere = () => this.createTag.createTag(this.name());

  private editRemote = (remoteName: string) =>
    this.dialog.open(EditRemoteComponent, {header: `Edit remote: ${remoteName}`, width: '450px', data: {remoteName}})!
      .onClose.subscribe(() => this.dialog.dialogComponentRefMap.clear());
}
