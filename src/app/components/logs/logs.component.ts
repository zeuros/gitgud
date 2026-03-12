import {TableModule} from 'primeng/table';
import {RefType} from '../../enums/ref-type.enum';
import {notUndefined, workingDirHasChanges} from '../../utils/utils';
import {Branch} from '../../lib/github-desktop/model/branch';
import {bySha} from '../../utils/log-utils';
import {DisplayRef} from '../../lib/github-desktop/model/display-ref';
import {Commit} from '../../lib/github-desktop/model/commit';
import {once, uniqBy} from 'lodash-es';
import {commitColor} from '../../utils/commit-utils';
import {first, interval, map} from 'rxjs';
import {IntervalTree} from 'node-interval-tree';
import {Edge} from '../../models/edge';
import {DragDropModule} from 'primeng/dragdrop';
import {SearchLogsComponent} from '../search-logs/search-logs.component';
import {Component, computed, effect, ElementRef, HostListener, inject, signal, untracked, ViewChild} from '@angular/core';
import {loadStashImage} from './log-draw-utils';
import {DatePipe, NgStyle} from '@angular/common';
import {local, remote} from '../../utils/branch-utils';
import {DATE_FORMAT} from '../../utils/constants';
import {GitRepositoryStore} from '../../stores/git-repos.store';
import {LogBuilderService} from '../../services/log-builder.service';
import {CANVAS_MARGIN, COMMITS_SHOWN_ON_CANVAS, NODE_RADIUS, NODES_VERTICAL_SPACING, ROW_HEIGHT} from './log-canvas-drawer-settings';
import {drawLog, xPosition, yPosition} from './logs-canvas-drawer';

@Component({
  selector: 'gitgud-logs',
  standalone: true,
  imports: [
    TableModule,
    DragDropModule,
    SearchLogsComponent,
    NgStyle,
    DatePipe,
  ],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
})
export class LogsComponent {

  private readonly gitRepositoryStore = inject(GitRepositoryStore);
  private readonly logBuilderService = inject(LogBuilderService);
  protected readonly commitsSelection = computed(() => {
    const selectedCommitsShas = this.gitRepositoryStore.selectedCommitsShas();
    return selectedCommitsShas ? this.computedDisplayLog()?.filter(l => selectedCommitsShas.includes(l.sha)) : [];
  });

  protected showSearchBar = false;
  protected searchBarFocus = {};
  protected graphColumnCount = signal<number>(0);
  protected computedDisplayLog = signal<DisplayRef[]>([]); // Commits ready for display
  protected edges = signal<IntervalTree<Edge>>(new IntervalTree<Edge>()); // Edges computed from displayLog
  private startCommit = this.gitRepositoryStore.startCommit();

  // signal holding the stash image
  private readonly stashImg = loadStashImage();

  @ViewChild('canvas', {static: false}) private canvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('logTable', {read: ElementRef}) private logTableRef?: ElementRef<HTMLElement>;


  constructor() {

    // Scroll to selected commit
    effect(() => {
      const sha = this.gitRepositoryStore.selectedCommitSha();
      if (sha) untracked(() => this.scrollToCommit(sha));
    });


    // When repository changes its logs, compute the log graph and draw it
    effect(() => {
      const logs = this.gitRepositoryStore.logs();
      const stashes = this.gitRepositoryStore.stashes();
      const workDirStatus = this.gitRepositoryStore.workDirStatus();
      // Wait for stash image before drawing stashes in the graph
      if (!this.stashImg() || !logs.length || !workDirStatus) return;

      untracked(() => this.onRepositoryLogChanges(workingDirHasChanges(workDirStatus), logs, stashes));
    });
  }

  get logTableElement() {
    return this.logTableRef?.nativeElement.querySelector('.p-datatable-table-container')!;
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
  protected branchesAndRef = (displayLogElement: DisplayRef) =>
    uniqBy([...displayLogElement.branchesDetails/*, this.findBranchByRef(displayLogElement.ref)*/], 'branchesDetails.name');

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

  private onRepositoryLogChanges = (workingDirHasChanges: boolean, logs: Commit[], stashes: Commit[]) => {
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

    this.afterLogsComputed(displayLog, edges);
  };

  private afterLogsComputed = (displayLog: DisplayRef[], edges: IntervalTree<Edge>) => {
    this.waitForCanvasToAppear.subscribe(canvasContext => {
      drawLog(
        canvasContext,
        displayLog,
        edges,
        this.startCommit,
        this.stashImg()!,
      );
      this.moveCanvasDown(this.startCommit);
      this.moveCommitWindow(canvasContext);

      this.afterLogFirstDisplay();
    });
  };

  // Called after log is computed and computedDisplayLog is set (runs once)
  private afterLogFirstDisplay = once(() => {

    // On first load, scroll down to last saved position, synchronous, fires no scroll events
    this.logTableElement.scrollTop = this.startCommit * ROW_HEIGHT;

    // Only after initial automatic scrolling we start recording user scrolling
    this.logTableElement.addEventListener('scroll', e => this.onTableScroll(e));
    this.logTableElement.addEventListener('scrollend', e => this.onTableScrollEnd(e));

  });

  private onTableScroll: EventListener = ({target}) => {
    this.startCommit = Math.floor((target as HTMLElement).scrollTop / ROW_HEIGHT);
    this.moveCommitWindow(this.canvasContext());
  };

  // Redraw the window of commits to display into log
  private moveCommitWindow = (canvas: CanvasRenderingContext2D) => {
    this.moveCanvasDown(this.startCommit);
    drawLog(
      canvas,
      this.computedDisplayLog(),
      this.edges(),
      this.startCommit,
      this.stashImg()!,
    );
  };

  private onTableScrollEnd: EventListener = ({target}) => {
    this.startCommit = Math.floor((target as HTMLElement).scrollTop / ROW_HEIGHT);
    this.gitRepositoryStore.updateSelectedRepository({startCommit: this.startCommit}); // saveSelectedRepository doesn't trigger observers (whole panel refresh)
  };

  private canvasContext = () => this.canvas?.nativeElement?.getContext('2d')!;

  // Canvas appears in the first row of the table, I don't know how to do it properly
  private waitForCanvasToAppear = interval(20).pipe(map(this.canvasContext), first(notUndefined));

  private moveCanvasDown = (startCommit: number) => this.canvas!.nativeElement.style.top = `${startCommit * ROW_HEIGHT}px`;

  // Scroll view to display the selected commit
  private scrollToCommit = (sha: string) => {
    const indexCommitToSelect = this.computedDisplayLog().findIndex(bySha(sha));

    if (!this.isOnView(indexCommitToSelect)) {
      this.waitForCanvasToAppear.subscribe(canvas => {
        const scrollToCommit = Math.max(Math.ceil(indexCommitToSelect - COMMITS_SHOWN_ON_CANVAS / 2), 0);
        this.startCommit = scrollToCommit;
        this.moveCommitWindow(canvas);
        this.logTableElement.scrollTo({top: scrollToCommit * ROW_HEIGHT});
      });
    }
  };

  protected readonly onCommitsSelection = (selection: DisplayRef[]) =>
    this.gitRepositoryStore.updateSelectedRepository({selectedCommitsShas: selection.map(s => s.sha)});

  private isOnView = (commitIndex: number) =>
    commitIndex > this.startCommit && commitIndex < this.startCommit + COMMITS_SHOWN_ON_CANVAS;

  protected readonly remote = remote;
  protected readonly local = local;
  protected readonly commitColor = commitColor;
  protected readonly DATE_FORMAT = DATE_FORMAT;
  protected readonly COMMITS_SHOWN_ON_CANVAS = COMMITS_SHOWN_ON_CANVAS;
  protected readonly NODE_RADIUS = NODE_RADIUS;
  protected readonly CANVAS_MARGIN = CANVAS_MARGIN;
  protected readonly NODES_VERTICAL_SPACING = NODES_VERTICAL_SPACING;
}
