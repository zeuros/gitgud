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

import {Table, TableModule} from 'primeng/table';
import {RefType} from '../../enums/ref-type.enum';
import {workingDirHasChanges} from '../../utils/utils';
import {bySha} from '../../utils/log-utils';
import {type DisplayRef} from '../../lib/github-desktop/model/display-ref';
import {Commit} from '../../lib/github-desktop/model/commit';
import {once} from 'lodash-es';
import {commitColor, findCurrentHeadCommit, hasName, isCommit, isIndex, isStash} from '../../utils/commit-utils';
import {IntervalTree} from 'node-interval-tree';
import {Edge} from '../../models/edge';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {afterNextRender, ChangeDetectionStrategy, Component, computed, effect, ElementRef, HostListener, inject, signal, untracked, viewChild} from '@angular/core';
import {loadStashImage} from './log-draw-utils';
import {DatePipe} from '@angular/common';
import {local, remote} from '../../utils/branch-utils';
import {DATE_FORMAT} from '../../utils/constants';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {LogBuilderService} from '../../services/log-builder.service';
import {CANVAS_DPR_MULTIPLIER, CANVAS_MARGIN, DRAWING_PAD_LEFT, GRAPH_COLUMN_MIN_WIDTH, NODE_RADIUS, NODES_VERTICAL_SPACING, ROW_HEIGHT} from './log-canvas-drawer-settings';
import {drawLog, xPosition, yPosition} from './logs-canvas-drawer';
import {ThemeService} from '../../services/theme.service';
import {CommitContextMenuService} from '../../services/commit-context-menu.service';
import {StashContextMenuService} from '../../services/stash-context-menu.service';
import {TagContextMenuService} from '../../services/tag-context-menu.service';
import {BranchContextMenuService} from '../../services/branch-context-menu.service';
import {ActiveContextMenuService} from '../../services/active-context-menu.service';
import {LogDragDropService} from '../../services/log-drag-drop.service';
import {type LocalAndDistantTagWithName} from '../../utils/tag-utils';
import {Branch} from '../../lib/github-desktop/model/branch';
import {Badge} from 'primeng/badge';
import {CreateBranchService} from '../../services/create-branch.service';
import {ConflictService} from '../../services/conflict.service';
import {InputText} from 'primeng/inputtext';
import {FormsModule} from '@angular/forms';
import {FixupService} from '../../services/fixup.service';
import {AvatarService} from '../commit-section/commit-infos/avatar/avatar.service';
import {BranchService} from '../../services/branch.service';
import {SearchLogsComponent} from '../search-logs/search-logs.component';
import {LogBranchChip} from './chips/log-branch-chip/log-branch-chip.component';
import {LogTagChip} from './chips/log-tag-chip/log-tag-chip.component';
import {AutofocusDirective} from '../../directives/autofocus.directive';
import {TitleIfOverflowDirective} from '../../directives/title-if-overflow.directive';

@Component({
  selector: 'gitgud-logs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {'[class.fixup-selection-mode]': 'fixup.selectingFixupTarget()'},
  imports: [
    TableModule,
    DragDropModule,
    DatePipe,
    Badge,
    InputText,
    FormsModule,
    LogBranchChip,
    LogTagChip,
    AutofocusDirective,
    TitleIfOverflowDirective,
    SearchLogsComponent,
  ],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
})
export class LogsComponent {

  protected currentRepo = inject(CurrentRepoStore);
  protected createBranch = inject(CreateBranchService);
  protected logDragDrop = inject(LogDragDropService);
  protected fixup = inject(FixupService);
  private branchContextMenu = inject(BranchContextMenuService);
  private tagContextMenu = inject(TagContextMenuService);
  private stashContextMenu = inject(StashContextMenuService);
  private commitContextMenu = inject(CommitContextMenuService);
  private logBuilder = inject(LogBuilderService);
  private activeContextMenu = inject(ActiveContextMenuService);
  private theme = inject(ThemeService);
  private branch = inject(BranchService);
  private conflict = inject(ConflictService);
  private avatar = inject(AvatarService);

  protected checkoutBranch = (branch: Branch | null, event: MouseEvent) => {
    event.stopPropagation();
    if (branch) this.branch.checkoutBranch(branch);
  };
  protected commitsSelection = computed(() => {
    const selectedCommitsShas = this.currentRepo.selectedCommitsShas();
    return selectedCommitsShas ? this.computedDisplayLog()?.filter(l => selectedCommitsShas.includes(l.sha)) : [];
  });

  protected showSearchBar = signal(false);
  protected graphColumnCount = signal(0);
  protected untrackedStashes = signal<string[]>([]); // Unused (edge case)
  protected computedDisplayLog = signal<DisplayRef[]>([]); // Commits ready for display
  protected firstCommitOffsetPx = signal(0); // Pixel-based scroll position for smooth canvas drawing
  private edges = signal(new IntervalTree<Edge>()); // Edges computed from displayLog
  private stashImg = loadStashImage();

  protected _canvasResized = signal({}); // When selectedRepository() changes, canvas is resized for some reason, it helps redraw the log at the good moment
  protected _canvasOverflows = computed(() => {
    const canvasWidth = xPosition(this.graphColumnCount() - 1) + NODE_RADIUS + 2 * DRAWING_PAD_LEFT;
    return canvasWidth > this._graphColumnWidth();
  });
  protected _branchColumnWidth = signal(0);
  protected _graphColumnWidth = signal(0);
  protected _tableScrollLeft = signal(0);
  protected dpr = signal(CANVAS_DPR_MULTIPLIER * (window.devicePixelRatio || 1));
  protected visibleCommitsCount = computed(() => this.countVisibleCommits(this._tableHeight(), this.computedDisplayLog()));
  private _layoutReady = signal(false);
  private _tableHeight = signal(0);
  private _tableHeaderHeight = signal(0);
  private _avatarImages = signal<Map<string, HTMLImageElement> | undefined>(undefined);
  private canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private canvasContext = computed(() => this.canvas()?.nativeElement?.getContext('2d'));
  private logTable = viewChild<Table<DisplayRef>>('logTable');
  private logTableRef = computed(() => this._layoutReady() ? this.logTable()?.el?.nativeElement as HTMLElement : undefined);
  private logTableContainer = computed(() => this.logTableRef()?.querySelector<HTMLElement>('.p-datatable-table-container'));

  constructor() {

    // Scroll to selected commit / stash
    effect(() => {
      const sha = this.currentRepo.selectedCommitSha();
      const startCommit = untracked(() => this.currentRepo.startCommit());
      const visibleCommitsCount = this.visibleCommitsCount();

      if (sha && visibleCommitsCount) {
        untracked(() => this.scrollToCommit(sha, startCommit, startCommit + visibleCommitsCount));
      }
    });


    // When repository changes its logs, stashes, branches, or working dir => recompute the log graph
    effect(() => {
      const logs = this.currentRepo.logs();
      const stashes = this.currentRepo.stashes();
      this.currentRepo.branches(); // FIXME: test this: if branches change, we want to update logs.commit.isPointedByLocalHead
      const workDirStatus = this.currentRepo.workDirStatus();
      // Wait for stash image before drawing stashes in the graph
      if (!this.stashImg() || !logs.length || !workDirStatus) return;

      untracked(() => this.computeDisplayLog(workingDirHasChanges(workDirStatus), logs, stashes));
    });

    // Pre-fetch avatars for all commits in the display log
    effect(() => {
      const commitMails = new Set(this.computedDisplayLog().filter(isCommit).map(c => (hasName(c.author) ? c.author : c.committer).email));
      this.avatar.loadAvatarImages(commitMails).subscribe(images => this._avatarImages.set(images));
    });

    // Reactively draw canvas when dependencies change
    effect(() => {
      const displayLog = this.computedDisplayLog();
      const edges = this.edges();
      const startCommit = this.currentRepo.startCommit();
      const scrollOffset = this.firstCommitOffsetPx();
      const stashImg = this.stashImg();
      const visibleCommitsCount = this.visibleCommitsCount();
      const logTableContainer = this.logTableContainer();
      const canvas = this.canvasContext();
      const avatarImages = this._avatarImages(); // re-run when new avatars load
      const {canvas: canvasColors} = this.theme.tokens(); // re-run on theme switch
      const headerHeight = this._tableHeaderHeight();

      if (this._canvasResized() && canvas && displayLog.length && stashImg && avatarImages && visibleCommitsCount && visibleCommitsCount > 0 && logTableContainer) {
        drawLog(canvas, displayLog, edges, startCommit, startCommit + visibleCommitsCount, scrollOffset, stashImg, avatarImages, canvasColors, headerHeight, this.dpr());
        untracked(() => this.restoreLastScrollPosition()); // will be called once
      }
    });

    // Position the canvas over the p-table GRAPH column
    effect((onCleanup) => {
      const logTableHeaders = this.logTableRef()?.querySelector('table')?.querySelectorAll('th');
      const branchTh = logTableHeaders?.[0];
      const graphTh = logTableHeaders?.[1];
      if (!branchTh || !graphTh) return;

      const ro = new ResizeObserver(() => {
        this._branchColumnWidth.set(branchTh.clientWidth);
        this._tableHeaderHeight.set(branchTh.clientHeight);
        this._graphColumnWidth.set(graphTh.clientWidth);
      });
      ro.observe(branchTh);
      ro.observe(graphTh);
      onCleanup(() => ro.disconnect());
    });

    effect((onCleanup) => {
      const logTableContainer = this.logTableContainer();
      if (!logTableContainer) return;
      const ro = new ResizeObserver(() => this._tableHeight.set(logTableContainer.clientHeight));
      ro.observe(logTableContainer);
      onCleanup(() => ro.disconnect());
    });

    effect((onCleanup) => {
      const canvas = this.canvas()?.nativeElement;
      if (!canvas) return;
      const ro = new ResizeObserver(() => this._canvasResized.set({}));
      ro.observe(canvas);
      onCleanup(() => ro.disconnect());
    });

    // Native scroll listener — replaces virtualScrollOptions.onScroll
    effect((onCleanup) => {
      const logTable = this.logTableContainer();
      if (!logTable) return;
      const onScroll = ({target}: Event) => {
        const {scrollTop, scrollLeft} = target as HTMLElement;
        this.activeContextMenu.hide();
        this.firstCommitOffsetPx.set(scrollTop % ROW_HEIGHT);
        this._tableScrollLeft.set(scrollLeft);
        this.currentRepo.update({startCommit: Math.floor(scrollTop / ROW_HEIGHT)});
      };
      logTable.addEventListener('scroll', onScroll, {passive: true});
      onCleanup(() => logTable.removeEventListener('scroll', onScroll));
    });

    afterNextRender(() => this._layoutReady.set(true));
    this.watchDpr();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent({ctrlKey, code}: KeyboardEvent) {
    if (ctrlKey && code == 'KeyF') {
      this.showSearchBar.set(true);
    } else if (code == 'Escape') {
      if (this.fixup.selectingFixupTarget()) {
        this.fixup.cancelFixupSelection();
      } else {
        this.showSearchBar.set(false);
        this.search('');
      }
    }
  }

  protected xPosition = xPosition;

  protected yPosition = yPosition;

  protected search = (searchString = '') => {
    const computedDisplayLog = this.computedDisplayLog();

    if (searchString == '') // Clear search
      return computedDisplayLog.forEach(commit => commit.highlight = undefined);

    computedDisplayLog.forEach(commit => commit.highlight = undefined);

    const searchStringL = searchString.toLowerCase();
    computedDisplayLog
      .filter(({sha, summary, author, committer}) => !(
        sha.includes(searchStringL)
        || summary.toLowerCase().includes(searchStringL)
        || author?.name?.toLowerCase().includes(searchStringL)
        || committer?.name?.toLowerCase().includes(searchStringL)
      ))
      .forEach(commit => commit.highlight = 'not-matched');

    const firstMatchIdx = computedDisplayLog.findIndex(c => !c.highlight);
    if (firstMatchIdx > 0) {
      this.currentRepo.update({startCommit: firstMatchIdx});
      this.logTableContainer()?.scrollTo({top: firstMatchIdx * ROW_HEIGHT});
    }
  };

  private computeDisplayLog = (workingDirHasChanges: boolean, logs: Commit[], stashes: Commit[]) => {
    const headCommit = workingDirHasChanges
      // IF detached mode, index(WIP) commit is on top of checked out commit, else checked out branch
      ? findCurrentHeadCommit(logs)
      : undefined;

    const indexParent = headCommit
      ? {...headCommit, branchesDetails: [], isPointedByLocalHead: true, refType: RefType.COMMIT} as DisplayRef
      : undefined;

    const {displayLog, edges, untrackedStashes, graphColumnCount} = this.logBuilder.buildDisplayLog(logs, stashes, indexParent);

    this.conflict.markWorkDirCommitConflicted(displayLog);

    this.computedDisplayLog.set(displayLog);
    this.edges.set(edges);
    this.graphColumnCount.set(graphColumnCount);
    this.untrackedStashes.set(untrackedStashes);

    // Auto-show the work in progress (index) commit — or first commit — when nothing valid is selected
    if (!this.currentRepo.selectedCommitsShas()?.length && displayLog.length) {
      this.currentRepo.update({selectedCommitsShas: [displayLog[0].sha]});
    }
  };

  // Called after canvas is available (runs once) — restores last scroll position
  private restoreLastScrollPosition = once(() => this.logTableContainer()?.scrollTo({top: this.currentRepo.startCommit() * ROW_HEIGHT}));

  // Scroll view to display the selected commit
  private scrollToCommit = (sha: string, startCommit: number, endCommit: number) => {
    const indexCommitToSelect = this.computedDisplayLog().findIndex(bySha(sha));

    if (!this.isOnView(indexCommitToSelect, startCommit, endCommit)) {
      const scrollToThisCommit = Math.max(Math.ceil(indexCommitToSelect - this.visibleCommitsCount()! / 2), 0);
      this.currentRepo.update({startCommit: scrollToThisCommit});
      this.logTableContainer()?.scrollTo({top: scrollToThisCommit * ROW_HEIGHT});
    }
  };

  protected onCommitsSelection = (selection: DisplayRef[]) => {
    if (this.fixup.selectingFixupTarget()) {
      const commit = selection[0];
      if (commit && isCommit(commit)) this.fixup.onCommitSelectedForFixup(commit);
      return;
    }
    this.currentRepo.update({selectedCommitsShas: selection.map(s => s.sha)});
  };

  private isOnView = (commitIndex: number, startCommit: number, endCommit: number) =>
    commitIndex > startCommit && commitIndex < endCommit;

  private watchDpr = () => window
    .matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    .addEventListener('change', () => {
      this.dpr.set(CANVAS_DPR_MULTIPLIER * (window.devicePixelRatio || 1));
      this.watchDpr();
    }, {once: true});

  private countVisibleCommits = (tableHeight: number, displayLog: DisplayRef[]) => {
    // Somehow, table takes time to settle to correct height, either debounce or set minimum height to be valid (did this)
    if (tableHeight < 100 || !displayLog.length) return undefined;

    const visibleRows = Math.ceil(tableHeight / ROW_HEIGHT);
    return Math.min(visibleRows, displayLog.length) + 2; // +2 for partially hidden commits (canvas draws commits before first row / after last row)
  };

  protected openCommitContextMenu = (commit: DisplayRef, event: PointerEvent) => {
    event.stopPropagation();

    if (isCommit(commit)) {
      this.commitContextMenu.selectedCommit.set(commit);
      this.activeContextMenu.show(this.commitContextMenu.commitContextMenu(), event);
    } else if (isStash(commit)) {
      this.stashContextMenu.selectedCommit.set(commit);
      this.activeContextMenu.show(this.stashContextMenu.stashContextMenu(), event);
    }
  };

  protected openTagContextMenu = (tagPair: LocalAndDistantTagWithName, event: MouseEvent) => {
    event.stopPropagation();
    this.tagContextMenu.selectedTag.set(tagPair);
    this.activeContextMenu.show(this.tagContextMenu.tagContextMenu(), event);
  };

  protected openBranchContextMenu = (branch: Branch, event: MouseEvent) => {
    event.stopPropagation();
    this.branchContextMenu.selectBranch(branch);
    this.activeContextMenu.show(this.branchContextMenu.branchContextMenu(), event);
  };

  protected remote = remote;
  protected local = local;
  protected commitColor = commitColor;
  protected isIndex = isIndex;
  protected DATE_FORMAT = DATE_FORMAT;
  protected NODE_RADIUS = NODE_RADIUS;
  protected CANVAS_MARGIN = CANVAS_MARGIN;
  protected GRAPH_COLUMN_MIN_WIDTH = GRAPH_COLUMN_MIN_WIDTH;
  protected NODES_VERTICAL_SPACING = NODES_VERTICAL_SPACING;
  protected DRAWING_PAD_LEFT = DRAWING_PAD_LEFT;
  protected ROW_HEIGHT = ROW_HEIGHT;
  protected $displayRef = (c: DisplayRef) => c;

}
