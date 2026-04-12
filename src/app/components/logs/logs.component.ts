import {Table, TableModule} from 'primeng/table';
import {RefType} from '../../enums/ref-type.enum';
import {workingDirHasChanges} from '../../utils/utils';
import {bySha} from '../../utils/log-utils';
import {DisplayRef} from '../../lib/github-desktop/model/display-ref';
import {Commit} from '../../lib/github-desktop/model/commit';
import {once} from 'lodash-es';
import {commitColor, isCommit, isIndex, isStash} from '../../utils/commit-utils';
import {IntervalTree} from 'node-interval-tree';
import {Edge} from '../../models/edge';
import {DragDropModule} from 'primeng/dragdrop';
import {SearchLogsComponent} from '../search-logs/search-logs.component';
import {afterNextRender, Component, computed, effect, ElementRef, HostListener, inject, signal, untracked, viewChild} from '@angular/core';
import {loadStashImage} from './log-draw-utils';
import {DatePipe} from '@angular/common';
import {local, normalizedBranchName, remote} from '../../utils/branch-utils';
import {DATE_FORMAT} from '../../utils/constants';
import {GitRepositoryStore} from '../../stores/git-repos.store';
import {LogBuilderService} from '../../services/log-builder.service';
import {CANVAS_MARGIN, NODE_RADIUS, NODES_VERTICAL_SPACING, ROW_HEIGHT} from './log-canvas-drawer-settings';
import {drawLog, xPosition, yPosition} from './logs-canvas-drawer';
import {ContextMenu} from 'primeng/contextmenu';
import {CommitContextMenuService} from './commit-context-menu.service';
import {StashContextMenuService} from './stash-context-menu.service';
import {Badge} from 'primeng/badge';

@Component({
  selector: 'gitgud-logs',
  standalone: true,
  imports: [
    TableModule,
    DragDropModule,
    SearchLogsComponent,
    DatePipe,
    ContextMenu,
    Badge,
  ],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
})
export class LogsComponent {

  private logBuilder = inject(LogBuilderService);
  protected gitRepositoryStore = inject(GitRepositoryStore);
  protected commitContextMenuService = inject(CommitContextMenuService);
  protected stashContextMenuService = inject(StashContextMenuService);
  protected contextMenuActiveCommit = signal<DisplayRef | undefined>(undefined);
  protected commitsSelection = computed(() => {
    const selectedCommitsShas = this.gitRepositoryStore.selectedCommitsShas();
    return selectedCommitsShas ? this.computedDisplayLog()?.filter(l => selectedCommitsShas.includes(l.sha)) : [];
  });

  protected showSearchBar = false;
  protected searchBarFocus = {};
  protected graphColumnCount = signal(0);
  protected untrackedStashes = signal<string[]>([]); // Unused (edge case)
  protected computedDisplayLog = signal<DisplayRef[]>([]); // Commits ready for display
  private edges = signal(new IntervalTree<Edge>()); // Edges computed from displayLog
  protected firstCommitOffsetPx = signal(0); // Pixel-based scroll position for smooth canvas drawing
  private stashImg = loadStashImage();

  private _layoutReady = signal(false);
  protected _canvasResized = signal({}); // When selectedRepository() changes, canvas is resized for some reason, it helps redraw the log at the good moment
  protected _branchColumnWidth = signal(0);
  private _tableHeight = signal(0);
  private canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private logTable = viewChild<Table<DisplayRef>>('logTable');
  private commitContextMenu = viewChild<ContextMenu>('commitContextMenu');
  private stashContextMenu = viewChild<ContextMenu>('stashContextMenu');
  private logTableRef = computed(() => this._layoutReady() ? this.logTable()?.el?.nativeElement as HTMLElement : undefined);
  private logTableContainer = computed(() => this.logTableRef()?.querySelector<HTMLElement>('.p-datatable-table-container'));
  protected visibleCommitsCount = computed(() => {
    const tableHeight = this._tableHeight();
    const displayLog = this.computedDisplayLog();

    // Somehow, table takes time to settle to correct height, either debounce or set minimum height to be valid (did this)
    if (tableHeight < 100 || !displayLog.length) return undefined;

    const visibleRows = Math.ceil(tableHeight / ROW_HEIGHT);
    return Math.min(visibleRows, displayLog.length) + 2; // +2 for partially hidden commits (canvas draws commits before first row / after last row)
  });

  constructor() {

    // Scroll to selected commit / stash
    effect(() => {
      const sha = this.gitRepositoryStore.selectedCommitSha();
      const logTable = this.logTableContainer();
      const startCommit = untracked(() => this.gitRepositoryStore.startCommit());
      const visibleCommitsCount = this.visibleCommitsCount();

      if (sha && logTable && visibleCommitsCount) {
        untracked(() => this.scrollToCommit(sha, logTable, startCommit, startCommit + visibleCommitsCount));
      }
    });


    // When repository changes its logs, stashes, working dir (index commit) => recompute the log graph
    effect(() => {
      const logs = this.gitRepositoryStore.logs();
      const stashes = this.gitRepositoryStore.stashes();
      const workDirStatus = this.gitRepositoryStore.workDirStatus();
      // Wait for stash image before drawing stashes in the graph
      if (!this.stashImg() || !logs.length || !workDirStatus) return;

      untracked(() => this.computeDisplayLog(workingDirHasChanges(workDirStatus), logs, stashes));
    });

    // Reactively draw canvas when dependencies change
    effect(() => {
      const displayLog = this.computedDisplayLog();
      const edges = this.edges();
      const startCommit = this.gitRepositoryStore.startCommit();
      const scrollOffset = this.firstCommitOffsetPx();
      const stashImg = this.stashImg();
      const visibleCommitsCount = this.visibleCommitsCount();
      const logTableContainer = this.logTableContainer();
      const canvas = this.canvas()?.nativeElement?.getContext('2d');

      if (this._canvasResized() && canvas && displayLog.length && stashImg && visibleCommitsCount && visibleCommitsCount > 0 && logTableContainer) {
        drawLog(canvas, displayLog, edges, startCommit, startCommit + visibleCommitsCount, scrollOffset, stashImg);
        untracked(() => this.setupScrollListeners(logTableContainer));// will be called once
      }
    });

    // Position the canvas over the p-table GRAPH column
    effect(() => {
      const firstTableTh = this.logTableRef()?.querySelector('table')?.querySelector('th');
      if (firstTableTh) new ResizeObserver(() => this._branchColumnWidth.set(firstTableTh.clientWidth)).observe(firstTableTh);
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

  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent({ctrlKey, code}: KeyboardEvent) {
    if (ctrlKey && code == 'KeyF') {
      this.showSearchBar = true;
      this.searchBarFocus = {}; // Triggers change detection on search bar component
    } else if (code == 'Escape') {
      this.showSearchBar = false;
      this.search('');
    }
  }

  protected normalizedBranchName = normalizedBranchName;

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

    this.computedDisplayLog.set(displayLog);
    this.edges.set(edges);
    this.graphColumnCount.set(graphColumnCount);
    this.untrackedStashes.set(untrackedStashes);
  };

  // Called after canvas is available (runs once)
  private setupScrollListeners = once((logTableContainer: Element) => {
    // On first load, scroll down to last saved position, synchronous, fires no scroll events
    logTableContainer.scrollTop = this.gitRepositoryStore.startCommit() * ROW_HEIGHT;

    // Only after initial automatic scrolling we start recording user scrolling
    logTableContainer.addEventListener('scroll', e => this.onTableScroll(e));

  });

  private onTableScroll: EventListener = ({target}) => {
    this.hideContextMenus();
    this.firstCommitOffsetPx.set((target as HTMLElement).scrollTop % ROW_HEIGHT); // Update pixel-based scroll for smooth canvas drawing
    const startCommit = Math.floor((target as HTMLElement).scrollTop / ROW_HEIGHT);
    this.gitRepositoryStore.updateSelectedRepository({startCommit}); // First commit to raw
  };

  // Scroll view to display the selected commit
  private scrollToCommit = (sha: string, logTable: HTMLElement, startCommit: number, endCommit: number) => {
    const indexCommitToSelect = this.computedDisplayLog().findIndex(bySha(sha));

    if (!this.isOnView(indexCommitToSelect, startCommit, endCommit)) {
      const scrollToThisCommit = Math.max(Math.ceil(indexCommitToSelect - this.visibleCommitsCount()! / 2), 0);
      this.gitRepositoryStore.updateSelectedRepository({startCommit: scrollToThisCommit});
      logTable.scrollTo({top: scrollToThisCommit * ROW_HEIGHT});
    }
  };

  protected onCommitsSelection = (selection: DisplayRef[]) =>
    this.gitRepositoryStore.updateSelectedRepository({selectedCommitsShas: selection.map(s => s.sha)});

  private isOnView = (commitIndex: number, startCommit: number, endCommit: number) =>
    commitIndex > startCommit && commitIndex < endCommit;

  protected openContextMenu = (commit: DisplayRef, $event: PointerEvent) => {
    this.contextMenuActiveCommit.set(commit);
    if (isCommit(commit)) {
      this.stashContextMenu()?.hide();
      this.commitContextMenuService.selectedCommit.set(commit);
      this.commitContextMenu()?.show($event);
    } else if (isStash(commit)) {
      this.commitContextMenu()?.hide();
      this.stashContextMenuService.selectedCommit.set(commit);
      this.stashContextMenu()?.show($event);
    }
  };

  protected hideContextMenus = () => {
    this.commitContextMenu()?.hide();
    this.stashContextMenu()?.hide();
  };

  protected remote = remote;
  protected local = local;
  protected commitColor = commitColor;
  protected isIndex = isIndex;
  protected DATE_FORMAT = DATE_FORMAT;
  protected NODE_RADIUS = NODE_RADIUS;
  protected CANVAS_MARGIN = CANVAS_MARGIN;
  protected NODES_VERTICAL_SPACING = NODES_VERTICAL_SPACING;
  protected $displayRef = (c: DisplayRef) => c;

}
