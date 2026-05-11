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
import {CdkDragEnd} from '@angular/cdk/drag-drop';
import {MenuItem} from 'primeng/api';
import {Branch, BranchType} from '../lib/github-desktop/model/branch';
import {parseRemote} from '../utils/branch-utils';
import {ActiveContextMenuService} from './active-context-menu.service';
import {GitWorkflowService} from './git-workflow.service';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {PopupService} from './popup.service';

@Injectable({providedIn: 'root'})
export class BranchDragDropService {
  private activeContextMenu = inject(ActiveContextMenuService);
  private gitWorkflow = inject(GitWorkflowService);
  private currentRepo = inject(CurrentRepoStore);
  private popup = inject(PopupService);

  draggingBranch = signal<Branch | null>(null);
  hoveredBranch = signal<Branch | null>(null);
  source = signal<Branch | undefined>(undefined);
  target = signal<Branch | undefined>(undefined);

  // True when the given branch would be a meaningful drop target for the current drag.
  // Only remote→remote produces no actions, so that's the only excluded pair.
  isValidDropTarget = (target: Branch | null): boolean => {
    const dragging = this.draggingBranch();
    if (!target || !dragging || target.tip.sha === dragging.tip.sha) return false;
    return dragging.type === BranchType.Local || target.type === BranchType.Local;
  };

  private menu = computed<MenuItem[]>(() => {
    const source = this.source();
    const target = this.target();
    if (!source || !target) return [];

    const isLocalSource = source.type === BranchType.Local;
    const isLocalTarget = target.type === BranchType.Local;
    const remoteRef = isLocalTarget ? (target.upstream ?? `origin/${target.name}`) : target.name;
    const items: MenuItem[] = [];

    if (isLocalSource && isLocalTarget) {
      if (this.isAncestor(source.tip.sha, target.tip.sha)) {
        items.push({label: `Fast-forward ${source.name} to ${target.name}`, icon: 'fa fa-forward', command: this.fastForward});
      }
      items.push({label: `Merge ${target.name} into ${source.name}`, icon: 'fa fa-compress', command: this.merge});
      items.push({label: `Rebase ${source.name} onto ${target.name}`, icon: 'fa fa-code-fork', command: this.rebase});
    } else if (isLocalSource && !isLocalTarget) {
      items.push({label: `Rebase ${source.name} onto ${target.name}`, icon: 'fa fa-code-fork', command: this.rebase});
      items.push({label: `Interactive Rebase ${source.name} onto ${target.name}`, icon: 'fa fa-list-ol', command: this.interactiveRebase});
    } else if (!isLocalSource && isLocalTarget) {
      if (this.isAncestor(source.tip.sha, target.tip.sha)) {
        items.push({label: `Fast-forward ${source.name} to ${target.name}`, icon: 'fa fa-forward', command: this.fastForwardRemote});
      }
      items.push({label: `Merge ${target.name} into ${source.name}`, icon: 'fa fa-compress', command: this.mergeLocalIntoRemote});
    }

    if (isLocalSource && remoteRef) {
      items.push({separator: true});
      items.push({label: `Push ${source.name} to ${remoteRef}`, icon: 'fa fa-cloud-upload', command: this.push});
    }

    return items;
  });

  onDragStarted = (branch: Branch | null) => this.draggingBranch.set(branch);

  completeDrop = (event: CdkDragEnd<Branch>) => {
    const source = this.draggingBranch();
    const target = this.hoveredBranch();

    event.source.reset();
    this.draggingBranch.set(null);
    this.hoveredBranch.set(null);

    if (!source || !target) return;

    this.source.set(source);
    this.target.set(target);

    this.activeContextMenu.show(this.menu(), event.event);
  };

  onMouseEnter = (branch: Branch | null) => {
    if (!branch) return;
    const dragging = this.draggingBranch();
    if (!dragging || branch.tip.sha === dragging.tip.sha) return;
    if (dragging.type === BranchType.Remote && branch.type === BranchType.Remote) return;
    this.hoveredBranch.set(branch);
  };

  onMouseLeave = () => this.hoveredBranch.set(null);

  // BFS through loaded commits to check if ancestorSha is reachable from descendantSha.
  private isAncestor = (ancestorSha: string, descendantSha: string): boolean => {
    if (ancestorSha === descendantSha) return false;
    const parentMap = new Map(this.currentRepo.logs().map(c => [c.sha, c.parentSHAs]));
    const visited = new Set<string>();
    const queue = [descendantSha];
    while (queue.length) {
      const sha = queue.shift()!;
      if (sha === ancestorSha) return true;
      if (visited.has(sha)) continue;
      visited.add(sha);
      for (const p of parentMap.get(sha) ?? []) queue.push(p);
    }
    return false;
  };

  private remoteRef = () => {
    const target = this.target()!;
    return target.type === BranchType.Local
      ? (target.upstream ?? `origin/${target.name}`)
      : target.name;
  };

  private fastForward = () => {
    const {name: src} = this.source()!;
    const {name: tgt} = this.target()!;
    this.gitWorkflow.checkoutThenRun(src, ['merge', '--ff-only', tgt], `Fast-forwarded ${src} to ${tgt}`);
  };

  private merge = () => {
    const {name: src} = this.source()!;
    const {name: tgt} = this.target()!;
    this.gitWorkflow.checkoutThenRun(src, ['merge', tgt], `Merged ${tgt} into ${src}`);
  };

  private rebase = () => {
    const {name: src} = this.source()!;
    const {name: tgt} = this.target()!;
    this.gitWorkflow.checkoutThenRun(src, ['rebase', tgt], `Rebased ${src} onto ${tgt}`, false);
  };

  private interactiveRebase = () =>
    this.popup.info('Interactive rebase requires a terminal');

  // Remote → Local: push the local target branch to the remote source ref (FF only)
  private fastForwardRemote = () => {
    const src = this.source()!;
    const {name: tgt} = this.target()!;
    const {remote, branch} = parseRemote(src.name);
    this.gitWorkflow.doRunAndRefresh(['push', remote, `${tgt}:${branch}`, '--ff-only'], `Fast-forwarded ${src.name} to ${tgt}`);
  };

  // Remote → Local: push the local target branch to the remote source ref
  private mergeLocalIntoRemote = () => {
    const src = this.source()!;
    const {name: tgt} = this.target()!;
    const {remote, branch} = parseRemote(src.name);
    this.gitWorkflow.doRunAndRefresh(['push', remote, `${tgt}:${branch}`], `Merged ${tgt} into ${src.name}`);
  };

  private push = () => {
    const {name: src} = this.source()!;
    const ref = this.remoteRef();
    const {remote, branch} = parseRemote(ref);
    this.gitWorkflow.doRunAndRefresh(['push', remote, `${src}:${branch}`], `Pushed ${src} to ${ref}`);
  };
}
