import {Table, TableModule} from 'primeng/table';
import {RefType} from '../../enums/ref-type.enum';
import {workingDirHasChanges} from '../../utils/utils';
import {Branch} from '../../lib/github-desktop/model/branch';
import {bySha} from '../../utils/log-utils';
import {DisplayRef} from '../../lib/github-desktop/model/display-ref';
import {Commit} from '../../lib/github-desktop/model/commit';
import {once, uniqBy} from 'lodash-es';
import {commitColor} from '../../utils/commit-utils';
import {IntervalTree} from 'node-interval-tree';
import {Edge} from '../../models/edge';
import {DragDropModule} from 'primeng/dragdrop';
import {SearchLogsComponent} from '../search-logs/search-logs.component';
import {afterNextRender, Component, computed, effect, ElementRef, HostListener, inject, signal, untracked, viewChild} from '@angular/core';
import {loadStashImage} from './log-draw-utils';
import {DatePipe} from '@angular/common';
import {local, remote} from '../../utils/branch-utils';
import {DATE_FORMAT} from '../../utils/constants';
import {GitRepositoryStore} from '../../stores/git-repos.store';
import {LogBuilderService} from '../../services/log-builder.service';
import {CANVAS_MARGIN, NODE_RADIUS, NODES_VERTICAL_SPACING, ROW_HEIGHT} from './log-canvas-drawer-settings';
import {drawLog, xPosition, yPosition} from './logs-canvas-drawer';

@Component({
  selector: 'gitgud-logs',
  standalone: true,
  imports: [
    TableModule,
    DragDropModule,
    SearchLogsComponent,
    DatePipe,
  ],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
})
export class LogsComponent {

  private gitRepositoryStore = inject(GitRepositoryStore);
  private logBuilderService = inject(LogBuilderService);
  protected commitsSelection = computed(() => {
    const selectedCommitsShas = this.gitRepositoryStore.selectedCommitsShas();
    return selectedCommitsShas ? this.computedDisplayLog()?.filter(l => selectedCommitsShas.includes(l.sha)) : [];
  });

  protected showSearchBar = false;
  protected searchBarFocus = {};
  protected graphColumnCount = signal(0);
  protected computedDisplayLog = signal<DisplayRef[]>([]); // Commits ready for display
  private edges = signal(new IntervalTree<Edge>()); // Edges computed from displayLog
  protected firstCommitOffsetPx = signal(0); // Pixel-based scroll position for smooth canvas drawing
  private stashImg = loadStashImage();

  private _layoutReady = signal(false);
  protected _branchColumnWidth = signal(0);
  private _tableHeight = signal(0);
  private canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private logTable = viewChild<Table<DisplayRef>>('logTable');
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

    // Scroll to selected commit
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

      if (canvas && displayLog.length && stashImg && visibleCommitsCount && visibleCommitsCount > 10 && logTableContainer) {
        drawLog(canvas, displayLog, edges, startCommit, startCommit + visibleCommitsCount, scrollOffset, stashImg);
        untracked(() => this.setupScrollListeners(logTableContainer));// will be called once
      }
    });

    // Position the canvas over the p-table GRAPH column
    effect(() => {
      const logTableContainer = this.logTableContainer();
      const firstTableTh = this.logTableRef()?.querySelector('table')?.querySelector('th');
      if (!firstTableTh || !logTableContainer) return;

      new ResizeObserver(() => this._branchColumnWidth.set(firstTableTh.offsetWidth)).observe(firstTableTh);
      new ResizeObserver(() => this._tableHeight.set(logTableContainer.clientHeight)).observe(logTableContainer);
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

  protected branchName = (b: Branch) => b.name.replace('origin/', '');

  protected xPosition = xPosition;

  protected yPosition = yPosition;

  // TODO: show ghost branch on the left of commit if merged
  protected branchesAndRef = (commit: DisplayRef) => uniqBy(commit.branchesDetails, 'branchesDetails.name');

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

    const {displayLog, edges, graphColumnCount} = this.logBuilderService.buildDisplayLog(logs, stashes, indexParent);

    this.computedDisplayLog.set(displayLog);
    this.edges.set(edges);
    this.graphColumnCount.set(graphColumnCount);
  };

  // Called after canvas is available (runs once)
  private setupScrollListeners = once((logTableContainer: Element) => {
    // On first load, scroll down to last saved position, synchronous, fires no scroll events
    logTableContainer.scrollTop = this.gitRepositoryStore.startCommit() * ROW_HEIGHT;

    // Only after initial automatic scrolling we start recording user scrolling
    logTableContainer.addEventListener('scroll', e => this.onTableScroll(e));

  });

  private onTableScroll: EventListener = ({target}) => {
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

  protected remote = remote;
  protected local = local;
  protected commitColor = commitColor;
  protected DATE_FORMAT = DATE_FORMAT;
  protected NODE_RADIUS = NODE_RADIUS;
  protected CANVAS_MARGIN = CANVAS_MARGIN;
  protected NODES_VERTICAL_SPACING = NODES_VERTICAL_SPACING;
  protected $displayRef = (c: DisplayRef) => c;

}
