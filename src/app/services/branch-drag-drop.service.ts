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
import type {CdkDragEnd} from '@angular/cdk/drag-drop';
import type {MenuItem} from 'primeng/api';
import {type Branch, BranchType} from '../lib/github-desktop/model/branch';
import type {LocalAndDistantTagWithName} from '../utils/tag-utils';
import {parseRemote} from '../utils/branch-utils';
import {commitCount, countCommitsNotIn, isAncestor} from '../utils/log-utils';
import {ActiveContextMenuService} from './active-context-menu.service';
import {GitWorkflowService} from './git-workflow.service';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {DialogService} from 'primeng/dynamicdialog';
import {BranchAheadBehindService} from './branch-ahead-behind.service';
import {InteractiveRebaseService} from './interactive-rebase.service';
import {ConflictPredictionService} from './conflict-prediction.service';
import {withConflictWarning} from '../utils/conflict-prediction.utils';
import {openBehindRemoteDialog, type BehindRemoteAction} from '../components/dialogs/behind-remote-dialog/behind-remote-dialog.component';

@Injectable({providedIn: 'root'})
export class BranchDragDropService {
  private activeContextMenu = inject(ActiveContextMenuService);
  private gitWorkflow = inject(GitWorkflowService);
  private currentRepo = inject(CurrentRepoStore);
  private dialog = inject(DialogService);
  private aheadBehind = inject(BranchAheadBehindService);
  private interactiveRebaseService = inject(InteractiveRebaseService);
  private conflictPrediction = inject(ConflictPredictionService);

  draggingBranch = signal<Branch | null>(null);
  hoveredBranch = signal<Branch | null>(null);
  hoveredTag = signal<LocalAndDistantTagWithName | null>(null);
  source = signal<Branch | undefined>(undefined);
  target = signal<Branch | undefined>(undefined);
  private tagTarget = signal<LocalAndDistantTagWithName | undefined>(undefined);

  // True when the given branch would be a meaningful drop target for the current drag.
  // Only remote→remote produces no actions, so that's the only excluded pair.
  isValidTagDropTarget = (tag: LocalAndDistantTagWithName | null): boolean => {
    const dragging = this.draggingBranch();
    if (!tag || !dragging) return false;
    return dragging.type === BranchType.Local && tag.sha !== dragging.tip.sha;
  };

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
    // Items grouped by the branch they move, so the menu tells which side changes
    const groups = new Map<string, MenuItem[]>([[source.name, []]]);
    const add = (moved: string, item: MenuItem) => groups.set(moved, [...groups.get(moved) ?? [], item]);
    const conflicts = this.conflictPrediction.conflictsBetween(target.tip.sha, source.tip.sha);
    const warn = (item: MenuItem) => withConflictWarning(item, conflicts);
    const logs = this.currentRepo.logs();
    // source is strictly behind target / strictly ahead of it; neither means diverged
    const behind = isAncestor(source.tip.sha, target.tip.sha, logs);
    const ahead = isAncestor(target.tip.sha, source.tip.sha, logs);
    const sourceOnly = commitCount(countCommitsNotIn(source.tip.sha, target.tip.sha, logs));
    const targetOnly = commitCount(countCommitsNotIn(target.tip.sha, source.tip.sha, logs));

    if (isLocalSource) {
      // Rebase and merge are no-ops or plain fast-forwards unless the branches diverged
      if (behind) add(source.name, {label: `Fast-forward ${source.name} to ${target.name} (${targetOnly})`, icon: 'fa fa-forward', command: this.fastForward});
      if (ahead && isLocalTarget) add(target.name, {label: `Fast-forward ${target.name} to ${source.name} (${sourceOnly})`, icon: 'fa fa-forward', command: this.fastForwardTarget});
      if (!behind && !ahead) {
        if (isLocalTarget) add(target.name, warn({label: `Merge ${source.name} into ${target.name} (${sourceOnly})`, icon: 'fa fa-compress', command: this.merge}));
        else add(source.name, warn({label: `Merge ${target.name} into ${source.name} (${targetOnly})`, icon: 'fa fa-compress', command: this.mergeRemoteIntoLocal}));
        add(source.name, warn({label: `Rebase ${source.name} onto ${target.name} (${sourceOnly})`, icon: 'fa fa-code-fork', command: this.rebase}));
      }
      // Still useful when ahead: reword/squash the commits target doesn't have yet
      if (!behind) add(source.name, warn({label: `Interactive Rebase ${source.name} onto ${target.name} (${sourceOnly})`, icon: 'fa fa-list-ol', command: this.interactiveRebase}));
    } else if (isLocalTarget) {
      if (behind) add(source.name, {label: `Fast-forward ${source.name} to ${target.name} (${targetOnly})`, icon: 'fa fa-forward', command: this.fastForwardRemote});
      add(source.name, {label: `Merge ${target.name} into ${source.name}`, icon: 'fa fa-compress', command: this.mergeLocalIntoRemote});
    }

    // Pushing a branch that's only behind its upstream has nothing to send
    if (isLocalSource && remoteRef && source.upstream === remoteRef) {
      const remoteTip = this.currentRepo.branches().find(b => b.name === remoteRef)?.tip.sha;
      if (remoteTip && remoteTip !== source.tip.sha && !isAncestor(source.tip.sha, remoteTip, logs)) {
        add(remoteRef, {label: `Push ${source.name} to ${remoteRef} (${commitCount(countCommitsNotIn(source.tip.sha, remoteTip, logs))})`, icon: 'fa fa-cloud-upload', command: this.push});
      }
    }

    return [...groups].filter(([, items]) => items.length).flatMap(([moved, items], i) => [
      ...(i ? [{separator: true}] : []),
      {label: `Updates ${moved}`, disabled: true, styleClass: 'menu-group-header'},
      ...items,
    ]);
  });

  private tagMenu = computed<MenuItem[]>(() => {
    const source = this.source();
    const tag = this.tagTarget();
    if (!source || !tag) return [];
    return [{label: `Reset ${source.name} on ${tag.name}`, icon: 'fa fa-undo', command: this.resetOnTag}];
  });

  onDragStarted = (branch: Branch | null) => this.draggingBranch.set(branch);

  completeDrop = (event: CdkDragEnd<Branch>) => {
    const source = this.draggingBranch();
    const target = this.hoveredBranch();
    const tagTarget = this.hoveredTag();

    event.source.reset();
    this.draggingBranch.set(null);
    this.hoveredBranch.set(null);
    this.hoveredTag.set(null);

    if (!source) return;

    if (tagTarget) {
      this.source.set(source);
      this.tagTarget.set(tagTarget);
      this.activeContextMenu.show(this.tagMenu(), event.event);
    } else if (target) {
      this.source.set(source);
      this.target.set(target);
      this.activeContextMenu.show(this.menu(), event.event);
      this.conflictPrediction.predictForMenu(target.tip.sha, source.tip.sha, this.menu);
    }
  };

  onMouseEnter = (branch: Branch | null) => {
    if (!branch) return;
    const dragging = this.draggingBranch();
    if (!dragging || branch.tip.sha === dragging.tip.sha) return;
    if (dragging.type === BranchType.Remote && branch.type === BranchType.Remote) return;
    this.hoveredBranch.set(branch);
  };

  onMouseLeave = () => this.hoveredBranch.set(null);

  onTagMouseEnter = (tag: LocalAndDistantTagWithName | null) => {
    if (!tag || this.draggingBranch()?.type !== BranchType.Local) return;
    this.hoveredTag.set(tag);
  };

  onTagMouseLeave = () => this.hoveredTag.set(null);

  private remoteRef = () => {
    const target = this.target()!;
    return target.type === BranchType.Local
      ? (target.upstream ?? `origin/${target.name}`)
      : target.name;
  };

  private fastForward = () => this.fastForwardRef(this.source()!.name, this.target()!.name);

  private fastForwardTarget = () => this.fastForwardRef(this.target()!.name, this.source()!.name);

  // Moves local branch `branch` up to `to` without checking it out; `fetch .` refuses non-FF updates.
  // git won't fetch into the checked out branch, so that one is merged with --ff-only instead.
  private fastForwardRef = (branch: string, to: string) => {
    const args = this.currentRepo.headBranch()?.name === branch
      ? ['merge', '--ff-only', to]
      : ['fetch', '.', `${to}:${branch}`];
    this.gitWorkflow.doRunAndRefresh(args, `Fast-forwarded ${branch} to ${to}`);
  };

  private mergeRemoteIntoLocal = () => {
    const {name: src} = this.source()!;
    const {name: tgt} = this.target()!;
    this.gitWorkflow.checkoutThenRun(src, ['merge', tgt], `Merged ${tgt} into ${src}`);
  };

  private merge = () => {
    const {name: src} = this.source()!;
    const {name: tgt} = this.target()!;
    this.gitWorkflow.mergeBranchInto(src, tgt, `Merge branch '${src}' into '${tgt}'`);
  };

  private rebase = () => {
    const {name: src} = this.source()!;
    const {name: tgt} = this.target()!;
    this.gitWorkflow.rebaseBranchOnto(src, tgt, `Rebased ${src} onto ${tgt}`);
  };

  private interactiveRebase = () => {
    const {name: src} = this.source()!;
    const {name: tgt} = this.target()!;
    if (this.currentRepo.headBranch()?.name == src) this.interactiveRebaseService.open(tgt);
    else this.gitWorkflow.runAndRefresh(['checkout', src]).subscribe(() => this.interactiveRebaseService.open(tgt));
  };

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

  private resetOnTag = () => {
    const {name: src} = this.source()!;
    const {name: tagName} = this.tagTarget()!;
    this.gitWorkflow.checkoutThenRun(src, ['reset', '--hard', tagName], `Reset ${src} on ${tagName}`);
  };

  private push = () => {
    const {name: src} = this.source()!;
    const ref = this.remoteRef();
    const {remote, branch} = parseRemote(ref);
    const ab = this.aheadBehind.aheadBehindMap()[src];
    if (!ab?.behind) {
      this.gitWorkflow.doRunAndRefresh(['push', remote, `${src}:${branch}`], `Pushed ${src} to ${ref}`);
      return;
    }
    const diverged = ab.ahead > 0;
    openBehindRemoteDialog(this.dialog, src, ref, diverged)
      .subscribe((action: BehindRemoteAction) => {
        if (action === 'force-push') this.gitWorkflow.doRunAndRefresh(['push', '--force-with-lease', remote, `${src}:${branch}`], `Force-pushed ${src} to ${ref}`);
        if (action === 'pull')       this.gitWorkflow.doRunAndRefresh(['fetch', remote, `${branch}:${src}`], `Pulled ${ref} into ${src}`);
        if (action === 'rebase')     this.gitWorkflow.rebaseBranchOnto(src, ref, `Rebased ${src} onto ${ref}`);
        if (action === 'merge')      this.gitWorkflow.checkoutThenRun(src, ['merge', '--no-ff', ref], `Merged ${ref} into ${src}`);
      });
  };
}
