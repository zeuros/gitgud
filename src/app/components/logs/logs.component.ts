import {TableModule} from 'primeng/table';
import {RefType} from '../../enums/ref-type.enum';
import {notUndefined, workingDirHasChanges} from '../../utils/utils';
import {Branch} from '../../lib/github-desktop/model/branch';
import {bySha} from '../../utils/log-utils';
import {DisplayRef} from '../../lib/github-desktop/model/display-ref';
import {Commit} from '../../lib/github-desktop/model/commit';
import {once, uniqBy} from 'lodash-es';
import {commitColor, hasName, initials, isCommit, isIndex, isMergeCommit} from '../../utils/commit-utils';
import {Coordinates} from '../../models/coordinates';
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

  protected readonly CANVAS_MARGIN = [5, 1];
  protected readonly NODE_DIAMETER = 26;
  protected readonly NODE_RADIUS = this.NODE_DIAMETER / 2;
  protected readonly NODES_VERTICAL_SPACING = 8;
  protected readonly ROW_HEIGHT = this.NODE_DIAMETER + this.NODES_VERTICAL_SPACING;
  protected readonly COMMITS_SHOWN_ON_CANVAS = 37; // TODO: change it on screen resize depending table row count

  protected readonly gitRepositoryStore = inject(GitRepositoryStore);
  protected readonly logBuilderService = inject(LogBuilderService);
  protected readonly branches = this.gitRepositoryStore.branches;
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

  protected xPosition = (col?: number) => this.NODE_RADIUS + (col ?? 0) * this.NODE_DIAMETER;

  protected yPosition = (row?: number) => this.NODE_RADIUS + (row ?? 0) * this.ROW_HEIGHT;

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
      this.drawLog(canvasContext, displayLog, edges);
      this.moveCanvasDown(this.startCommit);
      this.moveCommitWindow(canvasContext);

      this.afterLogFirstDisplay();
    });
  };

  // Called after log is computed and computedDisplayLog is set (runs once)
  private afterLogFirstDisplay = once(() => {

    // On first load, scroll down to last saved position, synchronous, fires no scroll events
    this.logTableElement.scrollTop = this.startCommit * this.ROW_HEIGHT;

    // Only after initial automatic scrolling we start recording user scrolling
    this.logTableElement.addEventListener('scroll', e => this.onTableScroll(e));
    this.logTableElement.addEventListener('scrollend', e => this.onTableScrollEnd(e));

  });

  private onTableScroll: EventListener = ({target}) => {
    this.startCommit = Math.floor((target as HTMLElement).scrollTop / this.ROW_HEIGHT);
    this.moveCommitWindow(this.canvasContext());
  };

  // Redraw the window of commits to display into log
  private moveCommitWindow = (canvas: CanvasRenderingContext2D) => {
    this.moveCanvasDown(this.startCommit);
    this.drawLog(canvas, this.computedDisplayLog(), this.edges());
  };

  private onTableScrollEnd: EventListener = ({target}) => {
    this.startCommit = Math.floor((target as HTMLElement).scrollTop / this.ROW_HEIGHT);
    this.gitRepositoryStore.updateSelectedRepository({startCommit: this.startCommit}); // saveSelectedRepository doesn't trigger observers (whole panel refresh)
  };


  private drawEdge = (canvas: CanvasRenderingContext2D, edge: Edge, startCommit: number) => {

    const topScroll = startCommit * this.ROW_HEIGHT;
    const [xParent, yParent] = [this.xPosition(edge.parentCol), this.yPosition(edge.parentRow) - topScroll];
    const [xChild, yChild] = [this.xPosition(edge.childCol), this.yPosition(edge.childRow) - topScroll];

    const isMergeCommit = edge.type == RefType.MERGE_COMMIT;
    this.prepareStyleForDrawingCommit(canvas, isMergeCommit ? edge.parentCol : edge.childCol);

    const isChildrenRight = xParent < xChild;

    if (isMergeCommit) {
      canvas.moveTo(xParent, yParent - this.NODE_RADIUS);
      if (xParent == xChild) {
        canvas.lineTo(xParent, yChild + this.NODE_RADIUS);
      } else {
        canvas.lineTo(xParent, yChild + this.NODE_RADIUS);
        if (isChildrenRight) {
          canvas.quadraticCurveTo(xParent, yChild, xParent + this.NODE_RADIUS, yChild);
          canvas.lineTo(xChild - this.NODE_RADIUS, yChild);
        } else { // Children left
          canvas.quadraticCurveTo(xParent, yChild, xParent - this.NODE_RADIUS, yChild);
          canvas.lineTo(xChild + this.NODE_RADIUS, yChild);
        }
      }
    } else {
      if (xParent == xChild) {
        canvas.moveTo(xParent, yParent - this.NODE_RADIUS);
        canvas.lineTo(xParent, yChild + this.NODE_RADIUS);
      } else {
        if (isChildrenRight) {
          canvas.moveTo(xParent + this.NODE_RADIUS, yParent);
          canvas.lineTo(xChild - this.NODE_RADIUS, yParent);
          canvas.quadraticCurveTo(xChild, yParent, xChild, yParent - this.NODE_RADIUS);
          canvas.lineTo(xChild, yChild + this.NODE_RADIUS);
        } else {
          canvas.moveTo(xParent - this.NODE_RADIUS, yParent);
          canvas.lineTo(xChild + this.NODE_RADIUS, yParent);
          canvas.quadraticCurveTo(xChild, yParent, xChild, yParent - this.NODE_RADIUS);
          canvas.lineTo(xChild, yChild + this.NODE_RADIUS);
        }
      }
    }

    canvas.setLineDash(edge.type == RefType.INDEX ? [3] : []);
    canvas.stroke();
  };


  /**
   * Draw each commit / stash and their connections
   */
  private drawLog = (canvas: CanvasRenderingContext2D, displayLog: DisplayRef[], edges: IntervalTree<Edge>) => {

    canvas.clearRect(0, 0, canvas.canvas.width, canvas.canvas.height);

    edges.search(this.startCommit, this.startCommit + this.COMMITS_SHOWN_ON_CANVAS)
      .forEach(edge => this.drawEdge(canvas, edge, this.startCommit));

    displayLog.slice(this.startCommit, this.startCommit + this.COMMITS_SHOWN_ON_CANVAS)
      .forEach((ref, indexForThisSlice) => this.drawNode(canvas, new Coordinates(indexForThisSlice, ref.indent!), ref));

    return canvas;
  };


  private drawNode(canvas: CanvasRenderingContext2D, commitCoordinates: Coordinates, ref: DisplayRef) {
    const [x, y] = [this.xPosition(commitCoordinates.col), this.yPosition(commitCoordinates.row)];

    this.prepareStyleForDrawingCommit(canvas, ref.indent!);

    if (isMergeCommit(ref)) {
      canvas.arc(x, y, this.NODE_RADIUS / 2.3, 0, 2 * Math.PI, true);
      canvas.fill();

      canvas.beginPath();
      canvas.arc(x, y, this.NODE_RADIUS / 1.4, 0, 2 * Math.PI, true);
      canvas.stroke();
    } else if (isCommit(ref)) {
      canvas.arc(x, y, this.NODE_RADIUS, 0, 2 * Math.PI, true);
      canvas.fill();

      this.prepareForCommitTextDraw(canvas);
      canvas.fillText(initials(hasName(ref.author) ? ref.author : ref.committer), x, y + 1);
      canvas.fill();
    } else if (isIndex(ref)) {
      canvas.arc(x, y, this.NODE_RADIUS - 1, 0, 2 * Math.PI, true);
      canvas.fillStyle = '#1c1e23';
      canvas.fill();
      canvas.setLineDash([3]);
      canvas.stroke();
    } else { // Stash
      // We made sure to load stashImg before drawing the log
      canvas.drawImage(this.stashImg()!, x - this.NODE_RADIUS, y - this.NODE_RADIUS, this.NODE_DIAMETER, this.NODE_DIAMETER);
    }
  };

  private prepareForCommitTextDraw(canvas: CanvasRenderingContext2D) {
    canvas.beginPath();
    canvas.fillStyle = 'white';
    canvas.font = 'normal 900 13.5px Roboto, sans-serif'; // Nunito not working here :/
    canvas.textAlign = 'center';
    canvas.textBaseline = 'middle';
    canvas.shadowColor = 'rgba(0, 0, 0, 0.8)';
    canvas.shadowBlur = 3;
  };

  private prepareStyleForDrawingCommit(canvas: CanvasRenderingContext2D, indent: number) {
    canvas.beginPath();
    canvas.lineWidth = 2;
    canvas.setLineDash([]);
    canvas.fillStyle = canvas.strokeStyle = 'rgba(206, 147, 216, 0.9)';
    canvas.filter = commitColor(indent);
    canvas.shadowColor = 'rgba(0, 0, 0, 0.8)';
    canvas.shadowBlur = 10;
  };

  private canvasContext = () => this.canvas?.nativeElement?.getContext('2d')!;

  // Canvas appears in the first row of the table, I don't know how to do it properly
  private waitForCanvasToAppear = interval(20).pipe(map(this.canvasContext), first(notUndefined));

  private moveCanvasDown = (startCommit: number) => this.canvas!.nativeElement.style.top = `${startCommit * this.ROW_HEIGHT}px`;

  // Scroll view to display the selected commit
  private scrollToCommit = (sha: string) => {
    const indexCommitToSelect = this.computedDisplayLog().findIndex(bySha(sha));

    if (!this.isOnView(indexCommitToSelect)) {
      this.waitForCanvasToAppear.subscribe(canvas => {
        const scrollToCommit = Math.max(Math.ceil(indexCommitToSelect - this.COMMITS_SHOWN_ON_CANVAS / 2), 0);
        this.startCommit = scrollToCommit;
        this.moveCommitWindow(canvas);
        this.logTableElement.scrollTo({top: scrollToCommit * this.ROW_HEIGHT});
      });
    }
  };

  protected readonly onCommitsSelection = (selection: DisplayRef[]) =>
    this.gitRepositoryStore.updateSelectedRepository({selectedCommitsShas: selection.map(s => s.sha)});

  private isOnView = (commitIndex: number) =>
    commitIndex > this.startCommit && commitIndex < this.startCommit + this.COMMITS_SHOWN_ON_CANVAS;

  protected readonly remote = remote;
  protected readonly local = local;
  protected readonly commitColor = commitColor;
  protected readonly DATE_FORMAT = DATE_FORMAT;
}
