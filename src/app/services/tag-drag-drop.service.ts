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
import {type CdkDragEnd} from '@angular/cdk/drag-drop';
import {type MenuItem} from 'primeng/api';
import {Branch, BranchType} from '../lib/github-desktop/model/branch';
import {isAncestor} from '../utils/log-utils';
import {ActiveContextMenuService} from './active-context-menu.service';
import {GitWorkflowService} from './git-workflow.service';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {type LocalAndDistantTagWithName} from '../utils/tag-utils';

@Injectable({providedIn: 'root'})
export class TagDragDropService {
  private activeContextMenu = inject(ActiveContextMenuService);
  private gitWorkflow = inject(GitWorkflowService);
  private currentRepo = inject(CurrentRepoStore);

  draggingTag = signal<LocalAndDistantTagWithName | null>(null);
  hoveredBranch = signal<Branch | null>(null);
  private source = signal<LocalAndDistantTagWithName | undefined>(undefined);
  private target = signal<Branch | undefined>(undefined);

  isValidDropTarget = (branch: Branch | null): boolean => {
    const dragging = this.draggingTag();
    if (!dragging || !branch) return false;
    return branch.type === BranchType.Local && branch.tip.sha !== dragging.sha;
  };

  private menu = computed<MenuItem[]>(() => {
    const tag = this.source();
    const branch = this.target();
    if (!tag || !branch) return [];

    if (isAncestor(tag.sha, branch.tip.sha, this.currentRepo.logs())) {
      return [{label: `Fast forward ${tag.name} to ${branch.name}`, icon: 'fa fa-forward', command: this.fastForwardTag}];
    }
    return [{label: `Merge ${tag.name} into ${branch.name}`, icon: 'fa fa-compress', command: this.merge}];
  });

  onDragStarted = (tag: LocalAndDistantTagWithName) => this.draggingTag.set(tag);

  completeDrop = (event: CdkDragEnd<LocalAndDistantTagWithName>) => {
    const tag = this.draggingTag();
    const branch = this.hoveredBranch();

    event.source.reset();
    this.draggingTag.set(null);
    this.hoveredBranch.set(null);

    if (!tag || !branch) return;

    this.source.set(tag);
    this.target.set(branch);
    this.activeContextMenu.show(this.menu(), event.event);
  };

  onMouseEnter = (branch: Branch | null) => {
    if (!branch || !this.draggingTag()) return;
    if (branch.type !== BranchType.Local) return;
    this.hoveredBranch.set(branch);
  };

  onMouseLeave = () => this.hoveredBranch.set(null);

  private fastForwardTag = () => {
    const {name} = this.source()!;
    const {name: branchName} = this.target()!;
    this.gitWorkflow.doRunAndRefresh(['tag', '-f', name, branchName], `Fast-forwarded tag ${name} to ${branchName}`);
  };

  private merge = () => {
    const {name: tagName} = this.source()!;
    const {name: branchName} = this.target()!;
    this.gitWorkflow.checkoutThenRun(branchName, ['merge', tagName], `Merged ${tagName} into ${branchName}`);
  };
}
