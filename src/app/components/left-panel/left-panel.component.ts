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

import {Component, computed, inject} from '@angular/core';
import {TerminalService} from 'primeng/terminal';
import {Tree} from 'primeng/tree';
import {CdkDropList} from '@angular/cdk/drag-drop';
import {ActiveContextMenuService} from '../../services/active-context-menu.service';
import {type TreeNode} from 'primeng/api';
import {Branch} from '../../lib/github-desktop/model/branch';
import {findNode, local, remote, toBranchTree} from '../../utils/branch-utils';
import {Commit} from '../../lib/github-desktop/model/commit';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {TableModule} from 'primeng/table';
import {Listbox} from 'primeng/listbox';
import {FormsModule} from '@angular/forms';
import {Splitter, type SplitterResizeEndEvent} from 'primeng/splitter';
import {type GitTag} from '../../models/git-tag';
import {TagContextMenuService} from '../../services/tag-context-menu.service';
import {StashContextMenuService} from '../../services/stash-context-menu.service';
import {type DisplayRef} from '../../lib/github-desktop/model/display-ref';
import {BranchContextMenuService} from '../../services/branch-context-menu.service';
import {BranchDragDropService} from '../../services/branch-drag-drop.service';
import {BranchService} from '../../services/branch.service';
import {BranchAheadBehindService} from '../../services/branch-ahead-behind.service';


@Component({
  selector: 'gitgud-left-panel',
  standalone: true,
  imports: [
    Tree,
    TableModule,
    Listbox,
    FormsModule,
    Splitter,
    CdkDropList,
  ],
  providers: [TerminalService],
  templateUrl: './left-panel.component.html',
  styleUrl: './left-panel.component.scss',
})
export class LeftPanelComponent {

  protected currentRepo = inject(CurrentRepoStore);
  protected tagContextMenu = inject(TagContextMenuService);
  protected stashContextMenu = inject(StashContextMenuService);
  protected localBranches = computed(() => toBranchTree(this.currentRepo.branches().filter(local) ?? []));
  protected remoteBranches = computed(() =>
    toBranchTree(this.currentRepo.branches().filter(remote) ?? [])
      .map(node => ({...node, type: 'remote-root'})));
  protected selectedBranchNode = computed(() => {
    const sha = this.currentRepo.selectedCommitSha();
    if (!sha) return null;
    return findNode([...this.localBranches(), ...this.remoteBranches()], sha);
  });
  protected branchContextMenu = inject(BranchContextMenuService);
  protected branchDragDrop = inject(BranchDragDropService);
  protected activeContextMenu = inject(ActiveContextMenuService);
  protected aheadBehind = inject(BranchAheadBehindService);
  private branch = inject(BranchService);

  protected selectBranchCommit = (branch?: Branch) => {
    if (branch) this.currentRepo.update({selectedCommitsShas: [branch.tip.sha]});
  };

  protected selectStash = (stash?: Commit) => {
    if (stash) this.currentRepo.update({selectedCommitsShas: [stash.parentSHAs[1]]});
  };

  protected selectTag = (tag?: GitTag) => {
    if (tag) this.currentRepo.update({selectedCommitsShas: [tag.sha]});
  };

  protected openStashContextMenu = (stash: Commit, event: MouseEvent) => {
    event.preventDefault();
    this.stashContextMenu.selectedCommit.set(stash as unknown as DisplayRef);
    this.activeContextMenu.show(this.stashContextMenu.stashContextMenu(), event);
  };

  protected openTagContextMenu = (tag: GitTag, event: MouseEvent) => {
    event.preventDefault();
    this.tagContextMenu.selectedTag.set(tag);
    this.activeContextMenu.show(this.tagContextMenu.tagContextMenu(), event);
  };

  protected checkoutBranch = (branch?: Branch) => {
    if (branch) this.branch.checkoutBranch(branch);
  };

  protected savePanelSizes = ({sizes}: SplitterResizeEndEvent) =>
    this.currentRepo.update({panelSizes: {...this.currentRepo.panelSizes()!, leftPanel: sizes.map(Number)}});

  protected prepareBranchContextMenu = (node: TreeNode<Branch>) => {
    this.branchContextMenu.selectedNode.set(node);
    this.activeContextMenu.contextMenu.set(this.branchContextMenu.branchContextMenu());
  };

  protected $branchNode = (branchNode: TreeNode<Branch>) => branchNode;
  protected $stash = (stash: Commit) => stash;
  protected $tag = (tag: GitTag) => tag;
}
