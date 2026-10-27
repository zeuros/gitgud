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

import {RefType} from '../../enums/ref-type.enum';
import {workingDirHasChanges} from '../../utils/utils';
import {bySha, followSelection} from '../../utils/log-utils';
import type {DisplayRef} from '../../lib/github-desktop/model/display-ref';
import type {Commit} from '../../lib/github-desktop/model/commit';
import {isEqual, once} from 'lodash-es';
import {commitColor, findCurrentHeadCommit, hasName, isCommit, isStash} from '../../utils/commit-utils';
import {IntervalTree} from 'node-interval-tree';
import type {Edge} from '../../models/edge';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {afterNextRender, ChangeDetectionStrategy, Component, computed, effect, type ElementRef, HostListener, inject, Injector, signal, untracked, viewChild} from '@angular/core';
import {loadStashImage} from './log-draw-utils';
import {DatePipe} from '@angular/common';
import {local, remote} from '../../utils/branch-utils';
import {DATE_FORMAT} from '../../utils/constants';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {LogBuilderService} from '../../services/log-builder.service';
import {CANVAS_DPR_MULTIPLIER, CANVAS_MARGIN, DRAWING_PAD_LEFT, NODE_RADIUS, NODES_VERTICAL_SPACING, ROW_HEIGHT} from './log-canvas-drawer-settings';
import {drawLog, xPosition, yPosition} from './logs-canvas-drawer';
import {ThemeService} from '../../services/theme.service';
import {CommitContextMenuService} from '../../services/commit-context-menu.service';
import {StashContextMenuService} from '../../services/stash-context-menu.service';
import {TagContextMenuService} from '../../services/tag-context-menu.service';
import {BranchContextMenuService} from '../../services/branch-context-menu.service';
import {ActiveContextMenuService} from '../../services/active-context-menu.service';
import {LogDragDropService} from '../../services/log-drag-drop.service';
import type {LocalAndDistantTagWithName} from '../../utils/tag-utils';
import type {Branch} from '../../lib/github-desktop/model/branch';
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
import {LogColumnsDirective} from './log-columns.directive';
import {moveSelection, type RowSelection, selectAll, selectRow} from './row-selection';
import {LogSearch} from './log-search';
import {onResize} from '../../utils/resize.utils';

// Rows rendered beyond the viewport, and granularity of render window moves
const RENDER_CHUNK = 20;

@Component({
  selector: 'gitgud-logs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {'[class.fixup-selection-mode]': 'fixup.selectingFixupTarget()'},
  imports: [
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
    LogColumnsDirective,
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
  private injector = inject(Injector);

  protected checkoutBranch = (branch: Branch | null, event: MouseEvent) => {
    event.stopPropagation();
    if (branch) this.branch.checkoutBranch(branch);
  };
  protected selectedShaSet = computed(() => new Set(this.currentRepo.selectedCommitsShas() ?? []));
  // Where shift+click / shift+arrow ranges start from (row indexes), the selected shas being in the store
  private selectionAnchor: Omit<RowSelection, 'keys'> = {};

  protected showSearchBar = signal(false);
  protected searchFocusRequest = signal(0);
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
  // Only rows near the viewport are rendered, [from, to) of the log; the table's margins stand in for the rows above / below,
  // so the scroll height and row positions are the same as with all rows rendered.
  // The window moves by RENDER_CHUNK rows, so scrolling only re-renders rows when crossing a chunk boundary
  protected renderWindow = computed(() => {
    const chunkStart = Math.floor(this.currentRepo.startCommit() / RENDER_CHUNK) * RENDER_CHUNK;
    return {from: Math.max(0, chunkStart - RENDER_CHUNK), to: chunkStart + (this.visibleCommitsCount() ?? 0) + 2 * RENDER_CHUNK};
  }, {equal: (a, b) => a.from === b.from && a.to === b.to});
  protected rowsBelowWindow = computed(() => Math.max(0, this.computedDisplayLog().length - this.renderWindow().to));
  private _layoutReady = signal(false);
  private _tableHeight = signal(0);
  private _tableHeaderHeight = signal(0);
  private _avatarImages = signal<Map<string, HTMLImageElement> | undefined>(undefined);
  private canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private canvasContext = computed(() => this.canvas()?.nativeElement?.getContext('2d'));
  private scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private logTableContainer = computed(() => this._layoutReady() ? this.scroller()?.nativeElement : undefined);

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
      // Rows hold Branch objects (context menu, drag & drop): rebuild when one changes without moving, e.g. its upstream
      this.currentRepo.branches();
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

    // Position the canvas over the GRAPH column
    onResize(() => {
      const [branchTh, graphTh] = this.logTableContainer()?.querySelectorAll('th') ?? [];
      return branchTh && graphTh ? [branchTh, graphTh] as HTMLElement[] : undefined;
    }, ([branchTh, graphTh]) => {
      this._branchColumnWidth.set(branchTh.clientWidth);
      this._tableHeaderHeight.set(branchTh.clientHeight);
      this._graphColumnWidth.set(graphTh.clientWidth);
    });

    onResize(this.logTableContainer, container => this._tableHeight.set(container.clientHeight));

    onResize(() => this.canvas()?.nativeElement, () => this._canvasResized.set({}));

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
  handleKeyboardEvent(event: KeyboardEvent) {
    const {ctrlKey, code} = event;
    if (ctrlKey && code == 'KeyF') {
      event.preventDefault();
      this.showSearchBar.set(true);
      this.searchFocusRequest.update(n => n + 1);
    } else if (code == 'Escape') {
      if (this.fixup.selectingFixupTarget()) {
        this.fixup.cancelFixupSelection();
      } else {
        this.showSearchBar.set(false);
        this.logSearch.search('');
      }
    }
  }

  // The log moves the selection on these keys (see onLogKeydown): leave them to the input typed in
  protected keepKeyInInput = (event: KeyboardEvent) => {
    const rowKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'];
    if (rowKeys.includes(event.code) || (event.code === 'KeyA' && (event.ctrlKey || event.metaKey))) event.stopPropagation();
  };

  protected xPosition = xPosition;

  protected yPosition = yPosition;

  protected logSearch = new LogSearch(this.computedDisplayLog, row => {
    this.currentRepo.update({startCommit: row});
    this.logTableContainer()?.scrollTo({top: row * ROW_HEIGHT});
  });

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

    const previousLog = this.computedDisplayLog();
    this.computedDisplayLog.set(displayLog);
    this.edges.set(edges);
    this.graphColumnCount.set(graphColumnCount);
    this.untrackedStashes.set(untrackedStashes);

    // Keeps the user's place when selected commits vanish (dropped, rewritten, branch deleted…)
    const selectedShas = this.currentRepo.selectedCommitsShas() ?? [];
    const followedShas = followSelection(selectedShas, previousLog, displayLog);
    if (!isEqual(followedShas, selectedShas)) this.currentRepo.update({selectedCommitsShas: followedShas});
  };

  // Called after canvas is available (runs once) — restores last scroll position, once the table's margins give the full scroll height
  private restoreLastScrollPosition = once(() => afterNextRender(
    () => this.logTableContainer()?.scrollTo({top: this.currentRepo.startCommit() * ROW_HEIGHT}),
    {injector: this.injector},
  ));

  // Scroll view to display the selected commit
  private scrollToCommit = (sha: string, startCommit: number, endCommit: number) => {
    const indexCommitToSelect = this.computedDisplayLog().findIndex(bySha(sha));

    if (!this.isOnView(indexCommitToSelect, startCommit, endCommit)) {
      const scrollToThisCommit = Math.max(Math.ceil(indexCommitToSelect - this.visibleCommitsCount()! / 2), 0);
      this.currentRepo.update({startCommit: scrollToThisCommit});
      this.logTableContainer()?.scrollTo({top: scrollToThisCommit * ROW_HEIGHT});
    }
  };

  // Click selects the row, ctrl+click toggles it, shift+click selects from the anchor (see row-selection)
  protected onRowClick = (index: number, event: MouseEvent) => {
    if ((event.target as Element).closest('input, button, a, textarea')) return;

    if (this.fixup.selectingFixupTarget()) {
      const commit = this.computedDisplayLog()[index];
      if (commit && isCommit(commit)) this.fixup.onCommitSelectedForFixup(commit);
      return;
    }

    if (event.shiftKey) window.getSelection()?.removeAllRanges(); // shift+click also extends the text selection
    this.setSelection(selectRow(this.rowKeys(), this.rowSelection(), index, {ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey}));
  };

  // Up / down move the selection, page up / down by a screen of rows (extending it with shift), Home / End jump to the
  // first / last commit (with or without ctrl), ctrl+A selects all
  protected onLogKeydown = (event: KeyboardEvent) => {
    const rowKeys = this.rowKeys();
    const page = Math.max(1, (this.visibleCommitsCount() ?? 3) - 3); // the rows fully shown, see scrollRowIntoView
    const delta = {ArrowUp: -1, ArrowDown: 1, PageUp: -page, PageDown: page, Home: -Infinity, End: Infinity}[event.code];
    if (delta !== undefined) {
      const selection = moveSelection(rowKeys, this.rowSelection(), delta, {shift: event.shiftKey});
      this.setSelection(selection);
      this.scrollRowIntoView(selection.rangeEnd ?? 0);
    } else if (event.code === 'KeyA' && (event.ctrlKey || event.metaKey)) {
      this.setSelection(selectAll(rowKeys));
    } else {
      return;
    }
    event.preventDefault();
  };

  private rowKeys = () => this.computedDisplayLog().map(c => c.sha);

  private rowSelection = (): RowSelection => ({keys: this.currentRepo.selectedCommitsShas() ?? [], ...this.selectionAnchor});

  private setSelection = ({keys, ...anchor}: RowSelection) => {
    this.selectionAnchor = anchor;
    this.currentRepo.update({selectedCommitsShas: keys});
  };

  private scrollRowIntoView = (index: number) => {
    const scroller = this.logTableContainer();
    const visible = this.visibleCommitsCount();
    if (!scroller || !visible) return;
    const first = Math.floor(scroller.scrollTop / ROW_HEIGHT);
    const last = first + visible - 3; // the last rows are behind the header height / partially hidden
    if (index < first) scroller.scrollTo({top: index * ROW_HEIGHT});
    else if (index > last) scroller.scrollTo({top: (index - visible + 3) * ROW_HEIGHT});
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
  protected DATE_FORMAT = DATE_FORMAT;
  protected NODE_RADIUS = NODE_RADIUS;
  protected CANVAS_MARGIN = CANVAS_MARGIN;
  protected NODES_VERTICAL_SPACING = NODES_VERTICAL_SPACING;
  protected DRAWING_PAD_LEFT = DRAWING_PAD_LEFT;
  protected ROW_HEIGHT = ROW_HEIGHT;

  // Blur also fires when the window loses focus (alt+tab): keep the input open in that case
  protected onBranchInputBlur = () => document.hasFocus() && this.createBranch.cancel();

}
