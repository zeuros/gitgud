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
import {MenuItem, TreeNode} from 'primeng/api';
import {Branch} from '../lib/github-desktop/model/branch';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {PopupService} from './popup.service';
import {BranchReaderService} from './electron-cmd-parser-layer/branch-reader.service';

@Injectable({providedIn: 'root'})
export class BranchContextMenuService {

  private currentRepo = inject(CurrentRepoStore);
  private popup = inject(PopupService);
  private branchReader = inject(BranchReaderService);

  selectedNode = signal<TreeNode<Branch> | undefined>(undefined);

  private countLeaves = (node: TreeNode<Branch>): number =>
    node.children?.length ? node.children.reduce((n, c) => n + this.countLeaves(c), 0) : 1;

  branchContextMenu = computed<MenuItem[]>(() => {
    const node = this.selectedNode();
    if (!node) return [];

    if (node.children?.length) {
      const label = node.label ?? '…';
      const count = this.countLeaves(node);
      return [{label: `Remove ${count} branches in ${label}`, icon: 'fa fa-trash', command: () => this.popup.info(`Remove ${count} branches in ${label}`)}];
    }

    const name = node.data?.name ?? '…';
    const head = this.currentRepo.headBranch()?.name ?? 'HEAD';
    return [
      // Remote
      {label: 'Pull (fast-forward if possible)', icon: 'fa fa-cloud-download', command: () => this.popup.info('Pull selected')},
      {label: 'Push', icon: 'fa fa-cloud-upload', command: () => this.popup.info('Push selected')},
      {label: 'Set Upstream', icon: 'fa fa-link', command: () => this.popup.info('Set Upstream selected')},
      {separator: true},
      // Integration
      {label: `Merge ${name} into ${head}`, icon: 'fa fa-compress', command: () => this.popup.info(`Merge ${name} into ${head}`)},
      {label: `Rebase ${head} onto ${name}`, icon: 'fa fa-code-fork', command: () => this.popup.info(`Rebase ${head} onto ${name}`)},
      {label: `Interactive Rebase ${head} onto ${name}`, icon: 'fa fa-list-ol', command: () => this.popup.info(`Interactive Rebase ${head} onto ${name}`)},
      {separator: true},
      // Checkout
      {label: `Checkout ${name}`, icon: 'fa fa-sign-in', command: () => node.data && this.branchReader.checkoutBranch(node.data)},
      {separator: true},
      // Commit ops
      {label: 'Create branch here', icon: 'fa fa-plus', command: () => this.popup.info('Create branch here selected')},
      {label: `Reset ${head} to this commit`, icon: 'fa fa-history', command: () => this.popup.info(`Reset ${head} to this commit`)},
      {separator: true},
      // Branch management
      {label: `Rename ${name}`, icon: 'fa fa-pencil', command: () => this.popup.info(`Rename ${name}`)},
      {label: `Delete ${name}`, icon: 'fa fa-trash', command: () => this.popup.info(`Delete ${name}`)},
      {separator: true},
      // Copy
      {label: 'Copy branch name', icon: 'fa fa-copy', command: () => navigator.clipboard.writeText(name)},
      {label: 'Copy commit SHA', icon: 'fa fa-copy', command: () => navigator.clipboard.writeText(node.data?.tip.sha ?? '')},
      {separator: true},
      // Tags
      {label: 'Create tag here', icon: 'fa fa-tag', command: () => this.popup.info('Create tag here selected')},
    ];
  });
}
