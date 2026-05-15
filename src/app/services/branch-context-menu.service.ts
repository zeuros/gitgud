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

import {computed, inject, Injectable, signal} from '@angular/core';
import {ConfirmationService, type MenuItem, type TreeNode} from 'primeng/api';
import {catchError, EMPTY, first} from 'rxjs';
import {Branch, BranchType} from '../lib/github-desktop/model/branch';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {notUndefined} from '../utils/utils';
import {GitWorkflowService} from './git-workflow.service';
import {PopupService} from './popup.service';
import {PromptService} from './prompt.service';
import {DialogService} from 'primeng/dynamicdialog';
import {EditRemoteComponent} from '../components/dialogs/edit-remote/edit-remote.component';
import {openSetUpstreamDialog} from '../components/dialogs/set-upstream-dialog/set-upstream-dialog.component';
import {CreateBranchService} from './create-branch.service';
import {normalizedBranchName} from '../utils/branch-utils';
import {BranchService} from './branch.service';
import {CreateTagService} from './create-tag.service';

@Injectable({providedIn: 'root'})
export class BranchContextMenuService {

  private currentRepo = inject(CurrentRepoStore);
  private popup = inject(PopupService);
  private confirmation = inject(ConfirmationService);
  private branch = inject(BranchService);
  private gitWorkflow = inject(GitWorkflowService);
  private prompt = inject(PromptService);
  private dialog = inject(DialogService);
  private createBranch = inject(CreateBranchService);
  private createTag = inject(CreateTagService);

  selectedNode = signal<TreeNode<Branch> | undefined>(undefined);

  selectBranch = (branch: Branch) => this.selectedNode.set({data: branch, label: branch.name});

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
      return [{label: `Remove ${count} branches in ${label}`, icon: 'fa fa-trash', command: () => this.popup.info(`Remove ${count} branches in ${label}`)}];
    }

    const name = this.name();
    const head = this.head();
    return [
      // Remote
      {label: 'Pull (fast-forward if possible)', icon: 'fa fa-cloud-download', command: this.pullBranch},
      {label: 'Push', icon: 'fa fa-cloud-upload', command: this.pushBranch},
      {label: 'Set Upstream', icon: 'fa fa-link', command: this.setUpstream},
      {separator: true},
      // Integration
      {label: `Merge ${name} into ${head}`, icon: 'fa fa-compress', command: this.mergeBranch},
      {label: `Rebase ${head} onto ${name}`, icon: 'fa fa-code-fork', command: this.rebaseBranch},
      {label: `Interactive Rebase ${head} onto ${name}`, icon: 'fa fa-list-ol', command: () => this.popup.info('Interactive rebase requires a terminal')},
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

  private pushBranch = () =>
    this.gitWorkflow.doRunAndRefresh(['push', 'origin', this.name()], `Pushed ${this.name()}`);

  private setUpstream = () =>
    openSetUpstreamDialog(this.dialog, this.name())
      .pipe(first(notUndefined))
      .subscribe(({remote, branch}) => this.gitWorkflow.doRunAndRefresh(['branch', `--set-upstream-to=${remote}/${branch}`, this.name()], `Upstream set to ${remote}/${branch}`));


  private mergeBranch = () =>
    this.gitWorkflow.doRunAndRefresh(['merge', this.name()], `Merged ${this.name()} into ${this.head()}`, true, true);

  private rebaseBranch = () =>
    this.gitWorkflow.doRunAndRefresh(['rebase', this.name()], `Rebased ${this.head()} onto ${this.name()}`, true, false);

  private createBranchHere = () => this.createBranch.createBranchAtSha(this.selectedNode()!.data!.tip!.sha!);

  private resetBranch = (mode: 'soft' | 'mixed' | 'hard') =>
    this.gitWorkflow.doRunAndRefresh(['reset', `--${mode}`, this.name()], `Reset ${mode} to ${this.name()}`, mode === 'hard', false);

  private renameBranch = () =>
    this.prompt.open(`New name for ${this.name()}:`)
      .pipe(first(notUndefined))
      .subscribe(newName => this.gitWorkflow.doRunAndRefresh(['branch', '-m', this.name(), newName], `Renamed ${this.name()} to ${newName}`));

  private deleteBranch = () => {
    const branch = this.selectedNode()!.data!;

    if (branch.type === BranchType.Remote) {
      this.gitWorkflow.doRunAndRefresh(['push', 'origin', '--delete', normalizedBranchName(branch)], `Deleted remote branch ${branch.name}`, false, false);
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
    this.dialog.open(EditRemoteComponent, {
      header: `Edit remote: ${remoteName}`,
      width: '450px',
      modal: true,
      data: {remoteName},
    })?.onClose.subscribe(() => this.dialog.dialogComponentRefMap.clear());
}
