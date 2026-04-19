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
import {Tree, TreeNodeDoubleClickEvent} from 'primeng/tree';
import {ContextMenu} from 'primeng/contextmenu';
import {MenuItem, TreeNode} from 'primeng/api';
import {PopupService} from '../../services/popup.service';
import {Branch} from '../../lib/github-desktop/model/branch';
import {findNode, local, remote, removeRemotePrefix, toBranchTree} from '../../utils/branch-utils';
import {Commit} from '../../lib/github-desktop/model/commit';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {TableModule} from 'primeng/table';
import {Listbox} from 'primeng/listbox';
import {FormsModule} from '@angular/forms';
import {Splitter, SplitterResizeEndEvent} from 'primeng/splitter';
import {BranchReaderService} from '../../services/electron-cmd-parser-layer/branch-reader.service';


@Component({
  selector: 'gitgud-left-panel',
  standalone: true,
  imports: [
    Tree,
    ContextMenu,
    TableModule,
    Listbox,
    FormsModule,
    Splitter,
  ],
  providers: [TerminalService],
  templateUrl: './left-panel.component.html',
  styleUrl: './left-panel.component.scss',
})
export class LeftPanelComponent {

  private readonly popupService = inject(PopupService);

  contextMenu: MenuItem[] = [
    {label: 'Pull (fast-forward if possible)', icon: 'pi pi-cloud-download', command: () => this.popupService.info('Pull (fast-forward if possible) selected')},
    {label: 'Push (Set Upstream)', icon: 'pi pi-cloud-upload', command: () => this.popupService.info('Push (Set Upstream) selected')},
    {label: 'Create branch here', icon: 'pi pi-plus', command: () => this.popupService.info('Create branch here selected')},
    {label: 'Reset main to this commit', icon: 'pi pi-step-backward', command: () => this.popupService.info('Reset main to this commit selected')},
    {label: 'Edit commit message', icon: 'pi pi-pencil', command: () => this.popupService.info('Edit commit message selected')},
    {label: 'Revert commit', icon: 'pi pi-replay', command: () => this.popupService.info('Revert commit selected')},
    {label: 'Drop commit', icon: 'pi pi-times-circle', command: () => this.popupService.info('Drop commit selected')},
    {label: 'Move commit down', icon: 'pi pi-arrow-down', command: () => this.popupService.info('Move commit down selected')},
    {label: 'Apply patch', icon: 'pi pi-file-edit', command: () => this.popupService.info('Apply patch selected')},
    {label: 'Rename the branch', icon: 'pi pi-pencil', command: () => this.popupService.info('Rename the branch selected')},
    {label: 'Delete the branch', icon: 'pi pi-times-circle', command: () => this.popupService.info('Delete the branch selected')},
    {label: 'Copy branch name', icon: 'pi pi-copy', command: () => this.popupService.info('Copy branch name selected')},
    {label: 'Copy commit sha', icon: 'pi pi-receipt', command: () => this.popupService.info('Copy commit sha selected')},
  ];

  protected readonly currentRepo = inject(CurrentRepoStore);
  private readonly branchReader = inject(BranchReaderService);
  protected readonly localBranches = computed(() => toBranchTree(this.currentRepo.branches().filter(local) ?? []));
  protected readonly remoteBranches = computed(() => toBranchTree(this.currentRepo.branches().filter(remote) ?? [], (n) => removeRemotePrefix(n) ?? n));
  protected readonly selectedBranchNode = computed(() => {
    const sha = this.currentRepo.selectedCommitSha();
    if (!sha) return null;
    return findNode([...this.localBranches(), ...this.remoteBranches()], sha);
  });

  protected readonly selectBranchCommit = (branch?: Branch) => {
    if (branch) this.currentRepo.update({selectedCommitsShas: [branch.tip.sha]});
  };

  protected readonly selectStash = (stash?: Commit) => {
    if (stash) this.currentRepo.update({selectedCommitsShas: [stash.parentSHAs[1]]});
  };

  protected checkoutBranch = (branch?: Branch) => {
      if (branch) this.branchReader.checkoutBranch(branch);
  };

  protected savePanelSizes = ({sizes}: SplitterResizeEndEvent) =>
    this.currentRepo.update({panelSizes: {...this.currentRepo.panelSizes()!, leftPanel: sizes.map(Number)}});

  protected readonly $branchNode = (branchNode: TreeNode<Branch>) => branchNode;
  protected readonly $stash = (stash: Commit) => stash;

}
