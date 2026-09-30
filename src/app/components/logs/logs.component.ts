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
import {CANVAS_DPR_MULTIPLIER, CANVAS_MARGIN, DRAWING_PAD_LEFT, NODE_RADIUS, NODES_VERTICAL_SPACING, ROW_HEIGHT} from './log-canvas-drawer-settings';
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
import {fitColumnWidths} from './fit-column-widths';

// Rows rendered beyond the viewport, and granularity of render window moves
const RENDER_CHUNK = 20;
// Default log column widths, relative to each other (Branch / Tag, Graph, Commit message, Author, Commit date / time).
// Commit date / time is fixed at its min-width, which fits its content
const LOG_COLUMN_SHARES = [3, 2, 5, 1.5, 0];

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
  // Only rows near the viewport are rendered: p-table gets the whole log (selection, shift-click ranges and row indexes stay
  // absolute) but renders the [first, first + rows) page of its hidden paginator; the rows above/below are table margins.
  // The window moves by RENDER_CHUNK rows, so scrolling only re-renders rows when crossing a chunk boundary
  protected renderWindow = computed(() => {
    const chunkStart = Math.floor(this.currentRepo.startCommit() / RENDER_CHUNK) * RENDER_CHUNK;
    return {from: Math.max(0, chunkStart - RENDER_CHUNK), to: chunkStart + (this.visibleCommitsCount() ?? 0) + 2 * RENDER_CHUNK};
  }, {equal: (a, b) => a.from === b.from && a.to === b.to});
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

    // Stand in for the non-rendered rows, so scroll height and row positions are the same as with all rows rendered.
    // Declared before the canvas effect: restoreLastScrollPosition needs the full scroll height
    effect(() => {
      const table = this.logTableRef()?.querySelector('table');
      const {from, to} = this.renderWindow();
      const logLength = this.computedDisplayLog().length;
      if (!table) return;
      table.style.marginTop = `${from * ROW_HEIGHT}px`;
      table.style.marginBottom = `${Math.max(0, logLength - to) * ROW_HEIGHT}px`;
      // stateStorage restores a saved first/rows (it's saved along column widths): keep the table on our window
      const logTable = untracked(this.logTable);
      if (logTable && (logTable.first() !== from || logTable.rows() !== to - from)) {
        logTable.first.set(from);
        logTable.rows.set(to - from);
      }
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

    // PrimeNG cancels a column resize that goes below a column's min-width (see Table.onColumnResizeEnd).
    // Clamp the resize helper line while dragging instead, so the resize stops at the resized/next column's min-width.
    effect(() => {
      const table = this.logTable() as any; // PrimeNG internals: resizeColumnElement, lastResizerHelperX, resizeHelperViewChild
      if (!table) return;
      const onColumnResize = table.onColumnResize.bind(table);
      table.onColumnResize = (event: MouseEvent) => {
        onColumnResize(event);
        const th: HTMLElement | undefined = table.resizeColumnElement;
        const next = th?.nextElementSibling as HTMLElement | null;
        const helper: HTMLElement | undefined = table.resizeHelperViewChild()?.nativeElement;
        if (!th || !next || !helper) return;
        const minWidth = (el: HTMLElement) => parseFloat(el.style.minWidth) || 16; // PrimeNG requires > 15px
        const startX = table.lastResizerHelperX;
        const min = startX - (th.offsetWidth - minWidth(th));
        const max = startX + (next.offsetWidth - minWidth(next));
        helper.style.left = `${Math.min(max, Math.max(min, parseFloat(helper.style.left)))}px`;
      };
    });

    // Position the canvas over the p-table GRAPH column
    effect((onCleanup) => {
      const table = this.logTableRef()?.querySelector('table');
      const logTableHeaders = [...table?.querySelectorAll('th') ?? []];
      const [branchTh, graphTh] = logTableHeaders;
      if (!table || !branchTh || !graphTh) return;

      const ro = new ResizeObserver(() => {
        this._branchColumnWidth.set(branchTh.clientWidth);
        this._tableHeaderHeight.set(branchTh.clientHeight);
        this._graphColumnWidth.set(graphTh.clientWidth);
      });
      [branchTh, graphTh].forEach(th => ro.observe(th));
      onCleanup(() => ro.disconnect());
    });

    // Fit the columns to the panel width, keeping each column's share of it (from the saved / user-resized widths).
    // Fixed table layout ignores cell min-width, so columns are sized here: a column that reaches its min-width stays
    // there and the others keep shrinking. The table only overflows (horizontal scroll) once every column is at its min.
    effect((onCleanup) => {
      const logTable = this.logTable() as any; // PrimeNG internals: columnWidthsState, styleElement
      const container = this.logTableContainer();
      const table = container?.querySelector('table');
      const ths = [...table?.querySelectorAll('th') ?? []];
      if (!logTable || !container || !table || ths.length !== LOG_COLUMN_SHARES.length) return;

      // Share 0 = fixed column, always at its min-width
      const withFixedColumns = (shares: number[]) => shares.map((share, i) => LOG_COLUMN_SHARES[i] ? share : 0);
      const minWidths = ths.map(th => parseFloat(th.style.minWidth) || 16);
      const savedWidths = (logTable.columnWidthsState as string | undefined)?.split(',').map(Number);
      let shares = withFixedColumns(savedWidths?.length === ths.length ? savedWidths : LOG_COLUMN_SHARES);

      const layout = () => {
        // PrimeNG applies restored / resized widths with a `width: …px !important` stylesheet, which would win over ours
        if (logTable.styleElement) logTable.styleElement.innerHTML = '';
        const widths = fitColumnWidths(container.clientWidth, shares, minWidths);
        ths.forEach((th, i) => th.style.width = `${widths[i]}px`);
        table.style.width = `${widths.reduce((sum, w) => sum + w, 0)}px`;
        table.style.minWidth = '';
      };

      const ro = new ResizeObserver(layout);
      ro.observe(container);
      const sub = logTable.onColResize.subscribe(() => {
        shares = withFixedColumns(ths.map(th => th.offsetWidth)); // widths PrimeNG just applied for the resize
        layout();
      });
      onCleanup(() => {
        ro.disconnect();
        sub.unsubscribe();
      });
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
  protected NODES_VERTICAL_SPACING = NODES_VERTICAL_SPACING;
  protected DRAWING_PAD_LEFT = DRAWING_PAD_LEFT;
  protected ROW_HEIGHT = ROW_HEIGHT;
  protected $displayRef = (c: DisplayRef) => c;
  // Display refs are rebuilt on every refresh: track by sha so p-table reuses row DOM instead of re-rendering all rows
  protected trackBySha = (_: number, c: DisplayRef) => c.sha;

  // Blur also fires when the window loses focus (alt+tab): keep the input open in that case
  protected onBranchInputBlur = () => document.hasFocus() && this.createBranch.cancel();

}
