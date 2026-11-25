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

import {ChangeDetectionStrategy, Component, computed, effect, type ElementRef, inject, signal, viewChild} from '@angular/core';
import {toObservable, toSignal} from '@angular/core/rxjs-interop';
import {concat, interval, map, of, scan, startWith, switchMap, timer} from 'rxjs';
import {InputText} from 'primeng/inputtext';
import {TerminalService} from 'primeng/terminal';
import {CdkDropList} from '@angular/cdk/drag-drop';
import {ActiveContextMenuService} from '../../services/active-context-menu.service';
import type {MenuItem, TreeNode} from 'primeng/api';
import type {Branch} from '../../lib/github-desktop/model/branch';
import {local, remote, toBranchTree} from '../../utils/branch-utils';
import {findNode} from '../../utils/tree-utils';
import type {Commit} from '../../lib/github-desktop/model/commit';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {TableModule} from 'primeng/table';
import {Listbox} from 'primeng/listbox';
import {FormsModule} from '@angular/forms';
import {Splitter, SplitterPanel} from 'primeng/splitter';
import {type LocalAndDistantTagWithName, toTagTree} from '../../utils/tag-utils';
import {TagContextMenuService} from '../../services/tag-context-menu.service';
import {StashContextMenuService} from '../../services/stash-context-menu.service';
import {BranchContextMenuService} from '../../services/branch-context-menu.service';
import {BranchDragDropService} from '../../services/branch-drag-drop.service';
import {BranchService} from '../../services/branch.service';
import {BranchAheadBehindService} from '../../services/branch-ahead-behind.service';
import {WorktreeContextMenuService} from '../../services/worktree-context-menu.service';
import type {GitWorktree} from '../../models/git-worktree';
import {GitRepositoryService} from '../../services/git-repository.service';
import {DialogService} from 'primeng/dynamicdialog';
import {CreateWorktreeDialogComponent} from '../dialogs/create-worktree-dialog/create-worktree-dialog.component';
import {TitleIfOverflowDirective} from '../../directives/title-if-overflow.directive';
import {TreeListComponent, type TreeNodeContextMenuEvent} from '../tree-list/tree-list.component';
import {otherWorktreeTooltip} from '../../utils/worktree-utils';
import {AgentWorktreeService} from '../../services/agent-worktree.service';
import {LlmSessionsService, type TranscriptSearch} from '../../services/llm-sessions.service';
import {agentName, agentStatus, isSameSession, type LlmSession, llmSessionLabel, relativeTime} from '../../utils/llm-session-utils';
import {Button} from 'primeng/button';
import {SplitButton} from 'primeng/splitbutton';

const TRANSCRIPT_SEARCH_DEBOUNCE_MS = 250;
const STARTING_SEARCH: TranscriptSearch = {results: [], isSearching: true};
const NO_SEARCH: TranscriptSearch = {results: [], isSearching: false};

@Component({
  selector: 'gitgud-left-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    TreeListComponent,
    TableModule,
    Listbox,
    FormsModule,
    Splitter,
    SplitterPanel,
    CdkDropList,
    TitleIfOverflowDirective,
    Button,
    SplitButton,
    InputText,
  ],
  providers: [TerminalService],
  templateUrl: './left-panel.component.html',
  styleUrl: './left-panel.component.scss',
})
export class LeftPanelComponent {

  protected currentRepo = inject(CurrentRepoStore);
  protected tagContextMenu = inject(TagContextMenuService);
  protected stashContextMenu = inject(StashContextMenuService);
  protected tagTree = signal<TreeNode<LocalAndDistantTagWithName>[]>([]);
  protected selectedTagKey = computed(() => {
    const sha = this.currentRepo.selectedCommitSha();
    return sha ? findNode(this.tagTree(), tag => tag.sha === sha)?.key : undefined;
  });
  protected localBranches = signal<TreeNode<Branch>[]>([]);
  protected remoteBranches = signal<TreeNode<Branch>[]>([]);
  // The selected commit's first chip: its local branch, and the remote branch paired with it
  private selectedChip = computed(() => {
    const sha = this.currentRepo.selectedCommitSha();
    return sha ? this.currentRepo.mergedBranchesByTip()[sha]?.[0] : undefined;
  });
  protected selectedLocalBranchKey = computed(() => this.keyOfBranch(this.localBranches(), this.selectedChip()?.localBranch));
  protected selectedRemoteBranchKey = computed(() => this.keyOfBranch(this.remoteBranches(), this.selectedChip()?.remoteBranch));
  protected branchContextMenu = inject(BranchContextMenuService);
  protected branchDragDrop = inject(BranchDragDropService);
  protected activeContextMenu = inject(ActiveContextMenuService);
  protected aheadBehind = inject(BranchAheadBehindService);
  protected worktreeContextMenu = inject(WorktreeContextMenuService);
  protected llmSessions = inject(LlmSessionsService);
  protected agentWorktree = inject(AgentWorktreeService);
  private branch = inject(BranchService);
  private dialog = inject(DialogService);
  private gitRepositoryService = inject(GitRepositoryService);

  constructor() {
    effect(() => this.localBranches.set(toBranchTree(this.currentRepo.branches().filter(local), branch => branch.isHeadPointed)));
    effect(() => {
      const upstream = this.currentRepo.branches().find(branch => local(branch) && branch.isHeadPointed)?.upstream;
      const remoteBranches = toBranchTree(this.currentRepo.branches().filter(remote), branch => branch.name === upstream);
      this.remoteBranches.set(remoteBranches.map(node => ({...node, type: 'remote-root'})));
    });
    effect(() => this.tagTree.set(toTagTree(this.currentRepo.allTagsByName())));
  }

  private keyOfBranch = (tree: TreeNode<Branch>[], branch?: Branch) =>
    branch ? findNode(tree, b => b.name === branch.name)?.key : undefined;

  protected selectBranchCommit = ({data: branch}: TreeNode<Branch>) => {
    if (branch) this.currentRepo.update({selectedCommitsShas: [branch.tip.sha]});
  };

  // The focused branch's or folder's menu: see onMenuOwnerKeydown
  protected onBranchTreeKeydown = (event: KeyboardEvent, tree: TreeListComponent<Branch>) => {
    const node = tree.focusedNode();
    if (!node) return;
    this.activeContextMenu.onMenuOwnerKeydown(
      event,
      () => {
        this.prepareBranchContextMenu(node);
        return this.branchContextMenu.branchContextMenu();
      },
      tree.focusedRowElement,
    );
  };

  // The focused tag's menu: see onMenuOwnerKeydown
  protected onTagTreeKeydown = (event: KeyboardEvent, tree: TreeListComponent<LocalAndDistantTagWithName>) => {
    const tag = tree.focusedNode()?.data;
    if (!tag) return;
    this.activeContextMenu.onMenuOwnerKeydown(
      event,
      () => {
        this.tagContextMenu.selectedTag.set(tag);
        return this.tagContextMenu.tagContextMenu();
      },
      tree.focusedRowElement,
    );
  };

  protected selectStash = (stash?: Commit) => {
    if (stash) this.currentRepo.update({selectedCommitsShas: [stash.parentSHAs[1]]});
  };

  protected selectTag = ({data: tag}: TreeNode<LocalAndDistantTagWithName>) => {
    if (tag) this.currentRepo.update({selectedCommitsShas: [(tag.local ?? tag.distant)!.sha]});
  };

  protected openStashContextMenu = (stash: Commit, event: MouseEvent) => {
    event.preventDefault();
    this.stashContextMenu.selectedStash.set(stash);
    this.activeContextMenu.show(this.stashContextMenu.stashContextMenu(), event);
  };

  protected openTagContextMenu = ({node: {data: tag}, event}: TreeNodeContextMenuEvent<LocalAndDistantTagWithName>) => {
    if (!tag) return;
    this.tagContextMenu.selectedTag.set(tag);
    this.activeContextMenu.show(this.tagContextMenu.tagContextMenu(), event);
  };

  protected checkoutBranch = (branch?: Branch) => {
    if (branch) this.branch.checkoutBranch(branch);
  };

  protected openBranchContextMenu = ({node, event}: TreeNodeContextMenuEvent<Branch>) => {
    this.prepareBranchContextMenu(node);
    this.activeContextMenu.show(this.branchContextMenu.branchContextMenu(), event);
  };

  private prepareBranchContextMenu = (node: TreeNode<Branch>) => this.branchContextMenu.selectedNode.set(node);

  protected selectWorktree = (wt: GitWorktree) => {
    if (wt.sha) this.currentRepo.update({selectedCommitsShas: [wt.sha]});
  };

  protected openWorktreeContextMenu = (wt: GitWorktree, event: MouseEvent) => {
    event.preventDefault();
    this.worktreeContextMenu.selectedWorktree.set(wt);
    this.activeContextMenu.show(this.worktreeContextMenu.worktreeContextMenu(), event);
  };

  protected addWorktree = () => this.dialog.open(CreateWorktreeDialogComponent, {header: 'Create Worktree', width: '520px'});

  /** Words searched in the transcripts; undefined while the search is closed */
  protected transcriptQuery = signal<string | undefined>(undefined);
  protected transcriptSearch = toSignal(toObservable(this.transcriptQuery).pipe(
    switchMap(query => query?.trim()
      ? concat(of(STARTING_SEARCH), timer(TRANSCRIPT_SEARCH_DEBOUNCE_MS).pipe(switchMap(() => this.llmSessions.searchTranscripts(query))))
      : of(NO_SEARCH)),
    // The previous results stay until the new search finds one, or finds none
    scan((previous, search) => search.isSearching && !search.results.length ? {...search, results: previous.results} : search),
    map(({results, isSearching}) => ({
      isSearching,
      results: results.flatMap(result => {
        const worktree = this.currentRepo.worktrees().find(({path}) => path === result.worktreePath);
        return worktree ? [{...result, worktree}] : [];
      }),
    })),
  ), {initialValue: {results: [], isSearching: false}});
  private transcriptSearchInput = viewChild<ElementRef<HTMLInputElement>>('transcriptSearchInput');

  protected openTranscriptSearch = () => {
    this.transcriptQuery.update(query => query ?? '');
    setTimeout(() => this.transcriptSearchInput()?.nativeElement.select());
  };

  protected onAgentsKeydown = (event: KeyboardEvent) => {
    if (event.ctrlKey && !event.shiftKey && event.code === 'KeyF') this.openTranscriptSearch();
    else if (event.code === 'Escape' && this.transcriptQuery() !== undefined) this.transcriptQuery.set(undefined);
    else return;
    // Keeps the log's own Ctrl+F and Escape out
    event.preventDefault();
    event.stopPropagation();
  };

  // Clicking the opened agent again closes its view; a double click's second click keeps it
  protected openAgent = ({session, worktree}: {session: LlmSession; worktree: GitWorktree}, {detail}: MouseEvent) => {
    if (detail > 1) return;

    const opened = this.llmSessions.openedSession();
    if (opened && isSameSession(opened, session)) return this.llmSessions.closeSession();

    this.selectWorktree(worktree);
    this.llmSessions.openedSession.set(session);
  };

  // Its row's click would open its view
  protected stopAgent = (event: MouseEvent, {pid}: LlmSession) => {
    event.stopPropagation();
    if (pid !== undefined) window.tauri.pty.kill(pid);
  };

  protected switchToWorktree = (wt: GitWorktree) => {
    if (!this.isCurrentWorktree(wt)) this.gitRepositoryService.switchWorktree(wt.path).subscribe();
  };

  protected isCurrentWorktree = ({path}: GitWorktree) => this.currentRepo.isCurrentWorktree(path);

  protected llmSessionsIn = ({path}: GitWorktree) => this.llmSessions.byWorktree().get(path) ?? [];
  protected llmSessionLabel = llmSessionLabel;
  protected runningAgents = computed(() => {
    const worktreeOfSession = new Map(this.currentRepo.worktrees().flatMap(worktree =>
      (this.llmSessions.byWorktree().get(worktree.path) ?? []).map(session => [session, worktree] as const)));
    return this.llmSessions.sessions().flatMap(session => {
      const worktree = worktreeOfSession.get(session);
      return worktree ? [{session, worktree}] : [];
    });
  });
  /** The running agents by worktree, the current worktree first */
  protected runningAgentGroups = computed(() => {
    const groups = new Map<string, {worktree: GitWorktree; agents: {session: LlmSession; worktree: GitWorktree}[]}>();
    for (const agent of this.runningAgents()) {
      const group = groups.get(agent.worktree.path) ?? {worktree: agent.worktree, agents: []};
      group.agents.push(agent);
      groups.set(agent.worktree.path, group);
    }
    return [...groups.values()].sort((a, b) => Number(this.isCurrentWorktree(b.worktree)) - Number(this.isCurrentWorktree(a.worktree)));
  });
  protected waitingAgentCount = computed(() => this.runningAgents().filter(({session}) => agentStatus(session) === 'waiting').length);
  protected agentStatus = agentStatus;
  protected agentName = (session: LlmSession) => agentName(session, this.llmSessions.titleOf(session));
  // Ticks each minute, for the ended agents' "5 min ago"
  private nowMs = toSignal(interval(60_000).pipe(startWith(0), map(() => Date.now())), {initialValue: Date.now()});
  protected endedAgo = ({endedAt}: LlmSession) => relativeTime(endedAt ?? 0, this.nowMs());

  /** "New": a worktree agent when Claude is installed, else the selected CLI here; its menu holds both */
  protected newAgentMenu = computed<MenuItem[]>(() => [
    ...this.llmSessions.installedClis().includes('claude')
      ? [{label: 'New worktree agent (Claude)', icon: 'fa fa-code-fork', command: () => this.agentWorktree.startWorktreeAgent()}]
      : [],
    ...this.llmSessions.installedClis().map(cli => ({
      label: `Run ${cli} in this worktree`,
      icon: 'fa fa-play',
      command: () => {
        this.llmSessions.selectedCli.set(cli);
        this.llmSessions.startAgent();
      },
    })),
  ]);
  protected startNewAgent = () => this.llmSessions.installedClis().includes('claude')
    ? this.agentWorktree.startWorktreeAgent()
    : this.llmSessions.startAgent();

  protected ENDED_AGENTS_SHOWN_BEFORE_HOVER = 3;
  // The Claude sessions that ended in them, the most recent first
  protected endedAgents = computed(() => this.currentRepo.worktrees()
    .flatMap(worktree => (this.llmSessions.endedByWorktree().get(worktree.path) ?? []).map(session => ({session, worktree})))
    .sort((a, b) => b.session.endedAt! - a.session.endedAt!));

  protected otherWorktreeTooltip = otherWorktreeTooltip;

  protected $stash = (stash: Commit) => stash;
  protected $localAndDistantTagWithName = (t: LocalAndDistantTagWithName) => t;
  protected $worktree = (wt: GitWorktree) => wt;
}
