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
import {DisplayRef} from '../../lib/github-desktop/model/display-ref';
import {Commit} from '../../lib/github-desktop/model/commit';
import {once} from 'lodash-es';
import {commitColor, hasName, isCommit, isIndex, isStash} from '../../utils/commit-utils';
import {IntervalTree} from 'node-interval-tree';
import {Edge} from '../../models/edge';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {afterNextRender, Component, computed, effect, ElementRef, HostListener, inject, signal, untracked, viewChild} from '@angular/core';
import {loadStashImage} from './log-draw-utils';
import {DatePipe} from '@angular/common';
import {local, remote} from '../../utils/branch-utils';
import {DATE_FORMAT} from '../../utils/constants';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {LogBuilderService} from '../../services/log-builder.service';
import {CANVAS_MARGIN, DRAWING_PAD_LEFT, GRAPH_COLUMN_MIN_WIDTH, CANVAS_DPR_MULTIPLIER, NODE_RADIUS, NODES_VERTICAL_SPACING, ROW_HEIGHT} from './log-canvas-drawer-settings';
import {drawLog, xPosition, yPosition} from './logs-canvas-drawer';
import {CommitContextMenuService} from '../../services/commit-context-menu.service';
import {StashContextMenuService} from '../../services/stash-context-menu.service';
import {TagContextMenuService} from '../../services/tag-context-menu.service';
import {BranchContextMenuService} from '../../services/branch-context-menu.service';
import {ActiveContextMenuService} from '../../services/active-context-menu.service';
import {BranchDragDropService} from '../../services/branch-drag-drop.service';
import {GitTag} from '../../models/git-tag';
import {Branch} from '../../lib/github-desktop/model/branch';
import {Badge} from 'primeng/badge';
import {CreateBranchService} from '../../services/create-branch.service';
import {ConflictService} from '../../services/conflict.service';
import {InputText} from 'primeng/inputtext';
import {FormsModule} from '@angular/forms';
import {FixupService} from '../../services/fixup.service';
import {AvatarService} from '../commit-section/commit-infos/avatar/avatar.service';
import {BranchService} from '../../services/branch.service';
import {LogBranchTag} from './log-branch-tag/log-branch-tag';
import {SearchLogsComponent} from '../search-logs/search-logs.component';

@Component({
  selector: 'gitgud-logs',
  standalone: true,
  host: {'[class.fixup-selection-mode]': 'fixup.selectingFixupTarget()'},
  imports: [
    TableModule,
    DragDropModule,
    DatePipe,
    Badge,
    InputText,
    FormsModule,
    LogBranchTag,
    SearchLogsComponent,
  ],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
})
export class LogsComponent {

  protected currentRepo = inject(CurrentRepoStore);
  protected createBranch = inject(CreateBranchService);
  protected commitContextMenu = inject(CommitContextMenuService);
  protected stashContextMenu = inject(StashContextMenuService);
  protected tagContextMenu = inject(TagContextMenuService);
  protected branchContextMenu = inject(BranchContextMenuService);
  protected branchDragDrop = inject(BranchDragDropService);
  protected fixup = inject(FixupService);
  private logBuilder = inject(LogBuilderService);
  private activeContextMenu = inject(ActiveContextMenuService);
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

  protected showSearchBar = false;
  protected graphColumnCount = signal(0);
  protected untrackedStashes = signal<string[]>([]); // Unused (edge case)
  protected computedDisplayLog = signal<DisplayRef[]>([]); // Commits ready for display
  protected firstCommitOffsetPx = signal(0); // Pixel-based scroll position for smooth canvas drawing
  private edges = signal(new IntervalTree<Edge>()); // Edges computed from displayLog
  private stashImg = loadStashImage();

  protected _canvasResized = signal({}); // When selectedRepository() changes, canvas is resized for some reason, it helps redraw the log at the good moment
  protected _canvasOverflows = signal(false);
  protected _branchColumnWidth = signal(0);
  protected _graphColumnWidth = signal(0);
  protected _tableScrollLeft = signal(0);
  protected dpr = signal(CANVAS_DPR_MULTIPLIER * (window.devicePixelRatio || 1));
  protected visibleCommitsCount = computed(() => this.countVisibleCommits(this._tableHeight(), this.computedDisplayLog()));
  private _layoutReady = signal(false);
  private _tableHeight = signal(0);
  private _avatarImages = signal<Map<string, HTMLImageElement> | undefined>(undefined);
  private canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private logTable = viewChild<Table<DisplayRef>>('logTable');
  private logTableRef = computed(() => this._layoutReady() ? this.logTable()?.el?.nativeElement as HTMLElement : undefined);
  private logTableContainer = computed(() => this.logTableRef()?.querySelector<HTMLElement>('.p-datatable-table-container'));

  constructor() {

    // Scroll to selected commit / stash
    effect(() => {
      const sha = this.currentRepo.selectedCommitSha();
      const logTable = this.logTableContainer();
      const startCommit = untracked(() => this.currentRepo.startCommit());
      const visibleCommitsCount = this.visibleCommitsCount();

      if (sha && logTable && visibleCommitsCount) {
        untracked(() => this.scrollToCommit(sha, logTable, startCommit, startCommit + visibleCommitsCount));
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
      const canvas = this.canvas()?.nativeElement?.getContext('2d');
      const avatarImages = this._avatarImages(); // re-run when new avatars load

      if (this._canvasResized() && canvas && displayLog.length && stashImg && avatarImages && visibleCommitsCount && visibleCommitsCount > 0 && logTableContainer) {
        drawLog(canvas, displayLog, edges, startCommit, startCommit + visibleCommitsCount, scrollOffset, stashImg, avatarImages);
        untracked(() => this.setupScrollListeners(logTableContainer));// will be called once
      }
    });

    // Position the canvas over the p-table GRAPH column
    effect(() => {
      const logTableHeaders = this.logTableRef()?.querySelector('table')?.querySelectorAll('th');
      const branchTh = logTableHeaders?.[0];
      if (branchTh) new ResizeObserver(() => this._branchColumnWidth.set(branchTh.clientWidth)).observe(branchTh);

      const graphTh = logTableHeaders?.[1];
      if (graphTh) new ResizeObserver(() => {
        this._graphColumnWidth.set(graphTh.clientWidth);
        const canvasWidth = xPosition(this.graphColumnCount() - 1) + NODE_RADIUS + 2 * DRAWING_PAD_LEFT;
        this._canvasOverflows.set(canvasWidth > graphTh.clientWidth);
      }).observe(graphTh);
    });

    effect(() => {
      const logTableContainer = this.logTableContainer();
      if (logTableContainer) new ResizeObserver(() => this._tableHeight.set(logTableContainer.clientHeight)).observe(logTableContainer);
    });

    effect(() => {
      const canvas = this.canvas()?.nativeElement;
      if (canvas) new ResizeObserver(() => this._canvasResized.set({})).observe(canvas);
    });

    afterNextRender(() => this._layoutReady.set(true));
    this.watchDpr();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent({ctrlKey, code}: KeyboardEvent) {
    if (ctrlKey && code == 'KeyF') {
      this.showSearchBar = true;
    } else if (code == 'Escape') {
      if (this.fixup.selectingFixupTarget()) {
        this.fixup.cancelFixupSelection();
      } else {
        this.showSearchBar = false;
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

    // TODO: Apply this filter on the displayed elements only
  };

  private computeDisplayLog = (workingDirHasChanges: boolean, logs: Commit[], stashes: Commit[]) => {
    const headCommit = workingDirHasChanges
      ? logs.find(c => c.branches.includes('HEAD ->'))
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
  };

  // Called after canvas is available (runs once)
  private setupScrollListeners = once((logTableContainer: Element) => {
    // On first load, scroll down to last saved position, synchronous, fires no scroll events
    logTableContainer.scrollTop = this.currentRepo.startCommit() * ROW_HEIGHT;

    // Only after initial automatic scrolling we start recording user scrolling
    logTableContainer.addEventListener('scroll', e => this.onTableScroll(e));

  });

  private onTableScroll: EventListener = ({target}) => {
    this.activeContextMenu.hide();
    this.firstCommitOffsetPx.set((target as HTMLElement).scrollTop % ROW_HEIGHT); // Update pixel-based scroll for smooth canvas drawing
    this._tableScrollLeft.set((target as HTMLElement).scrollLeft);
    const startCommit = Math.floor((target as HTMLElement).scrollTop / ROW_HEIGHT);
    this.currentRepo.update({startCommit}); // First commit to raw
  };

  // Scroll view to display the selected commit
  private scrollToCommit = (sha: string, logTable: HTMLElement, startCommit: number, endCommit: number) => {
    const indexCommitToSelect = this.computedDisplayLog().findIndex(bySha(sha));

    if (!this.isOnView(indexCommitToSelect, startCommit, endCommit)) {
      const scrollToThisCommit = Math.max(Math.ceil(indexCommitToSelect - this.visibleCommitsCount()! / 2), 0);
      this.currentRepo.update({startCommit: scrollToThisCommit});
      logTable.scrollTo({top: scrollToThisCommit * ROW_HEIGHT});
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

  protected openTagContextMenu = (tag: GitTag, event: MouseEvent) => {
    event.stopPropagation();
    this.tagContextMenu.selectedTag.set(tag);
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
  protected $displayRef = (c: DisplayRef) => c;

}
