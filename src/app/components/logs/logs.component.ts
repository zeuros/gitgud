import {GitRepository} from '../../models/git-repository';
import {TableModule} from 'primeng/table';
import {Commit} from '../../lib/github-desktop/model/commit';
import {RefType} from '../../enums/ref-type.enum';
import {notUndefined, removeDuplicates} from '../../utils/utils';
import {Stash} from '../../models/stash';
import {Branch, BranchType} from "../../lib/github-desktop/model/branch";
import {byName, bySha, logsAreEqual} from "../../utils/log-utils";
import {DisplayRef} from "../../lib/github-desktop/model/display-ref";
import {max, once, uniqBy} from "lodash";
import {
  buildChildrenMap,
  buildShaMap,
  ChildrenMap,
  commitColor,
  edgeType,
  hasName,
  initials,
  isCommit,
  isIndex,
  isMergeCommit,
  isRootCommit,
  isStash,
  ShaMap,
  stashParentCommitSha
} from "../../utils/commit-utils";
import {Coordinates} from "../../models/coordinates";
import {distinctUntilChanged, filter, first, interval, map} from "rxjs";
import {IntervalTree} from "node-interval-tree";
import {Edge} from "../../models/edge";
import {GitRepositoryService} from "../../services/git-repository.service";
import {DragDropModule} from "primeng/dragdrop";
import {SearchLogsComponent} from "../search-logs/search-logs.component";
import {AfterViewInit, Component, ElementRef, HostListener, input, signal, ViewChild} from '@angular/core';
import {DatePipe, NgForOf, NgIf, NgStyle} from "@angular/common";
import {local, remote} from "../../utils/branch-utils";
import {toObservable} from "@angular/core/rxjs-interop";
import {DATE_FORMAT} from '../../utils/constants';

type Column = ['taken' | 'free', rowCount: number];
const indexCommit = (parentCommit: DisplayRef) => ({
  summary: 'WIP',
  ref: parentCommit.ref,
  sha: 'index',
  parentSHAs: [parentCommit.sha] as ReadonlyArray<string>,
  branchesDetails: [] as Branch[],
  refType: RefType.INDEX,
  isPointedByLocalHead: false,
  author: {},
  committer: {},
} as DisplayRef);

@Component({
  selector: 'gitgud-logs',
  standalone: true,
  imports: [
    TableModule,
    DragDropModule,
    SearchLogsComponent,
    NgStyle,
    DatePipe,
    NgIf,
    NgForOf,
  ],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
})
export class LogsComponent implements AfterViewInit {

  protected readonly CANVAS_MARGIN = [5, 1];
  protected readonly NODE_DIAMETER = 26;
  protected readonly NODE_RADIUS = this.NODE_DIAMETER / 2;
  protected readonly NODES_VERTICAL_SPACING = 8;
  protected readonly ROW_HEIGHT = this.NODE_DIAMETER + this.NODES_VERTICAL_SPACING;
  protected readonly COMMITS_SHOWN_ON_CANVAS = 37; // TODO: change it on screen resize depending table row count

  gitRepository = input<GitRepository>();
  protected branches: ReadonlyArray<Branch> = []; // Local and distant branches
  protected showSearchBar = false;
  protected graphColumnCount?: number;
  protected searchBarFocus = {};
  protected computedDisplayLog: DisplayRef[] = []; // Commits ready for display
  private treeLockedColumn?: number;
  private columns: Column[] = []; // keep track of the states of the columns when drawing commits from top to bottom
  private edges?: IntervalTree<Edge>; // Edges are updated after computedDisplayLog is set
  private gitRepository$ = toObservable(this.gitRepository).pipe(filter(notUndefined));
  private startCommit = 0;
  protected selectedCommits = signal<DisplayRef[]>([]);
  @ViewChild("canvas", {static: false}) private canvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild("logTable", {read: ElementRef}) private logTableRef?: ElementRef<HTMLElement>;

  constructor(
    private gitRepositoryService: GitRepositoryService,
  ) {
    this.gitRepository$
      .subscribe(this.onEveryRepositoryChanges)

    // Listen to commit selection (click on a branch for example)
    this.gitRepository$
      .pipe(map(gitRepository => gitRepository.highlightedCommitSha), distinctUntilChanged(), filter(notUndefined))
      .subscribe(this.selectAndScrollToCommit);

    // When repository changes its logs
    this.gitRepository$
      .pipe(filter(gitRepository => gitRepository?.logs.length > 0), distinctUntilChanged(logsAreEqual))
      .subscribe(this.onRepositoryLogChanges);

    toObservable(this.selectedCommits).subscribe(selectedCommits => this.gitRepositoryService.updateCurrentRepository({selectedCommits}))
  }

  get logTableElement() {
    return this.logTableRef?.nativeElement.querySelector(".p-datatable-table-container")!
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

  ngAfterViewInit() {
    this.logTableElement.addEventListener("scroll", this.onTableScroll);
    this.logTableElement.addEventListener("scrollend", this.onTableScrollEnd);
  }

  protected branchName = (b: Branch) => b.name.replace('origin/', '');

  protected xPosition = (col?: number) => this.NODE_RADIUS + (col ?? 0) * this.NODE_DIAMETER;

  protected yPosition = (row?: number) => this.NODE_RADIUS + (row ?? 0) * this.ROW_HEIGHT;

  // TODO: show ghost branch on the left of commit if merged
  protected branchesAndRef = (displayLogElement: DisplayRef) =>
    uniqBy([...displayLogElement.branchesDetails/*, this.findBranchByRef(displayLogElement.ref)*/], 'branchesDetails.name');

  protected search = (searchString = '') => {
    if (searchString == '') // Clear search
      return this.computedDisplayLog.forEach(commit => commit.highlight = undefined);

    this.computedDisplayLog.forEach(commit => commit.highlight = undefined);

    const searchStringL = searchString.toLowerCase();
    this.computedDisplayLog
      .filter(({sha, summary, author, committer}) => !(
        sha.includes(searchStringL)
        || summary.toLowerCase().includes(searchStringL)
        || author?.name?.toLowerCase().includes(searchStringL)
        || committer?.name?.toLowerCase().includes(searchStringL)
      ))
      .forEach(commit => commit.highlight = 'not-matched');

    // TODO: Apply this filter on the displayed elements only
  }

  private onRepositoryLogChanges = (gitRepository: GitRepository) => {
    const commits = gitRepository.logs.map(this.commitToDisplayRef);

    // "Index" commit (working directory)
    const indexParent = commits.find(c => c.isPointedByLocalHead);
    if (indexParent) commits.unshift(indexCommit(indexParent));

    // TODO: Finish stashes
    const stashes: DisplayRef[] = []; // gitRepository.stashes.map(this.stashToDisplayRef);

    const shaMap = buildShaMap([...commits, ...stashes]);
    const childrenMap = buildChildrenMap([...commits, ...stashes]);

    const displayLog = this.saveRowIndexIntoDisplayRef(this.insertStashesIntoCommits(commits, stashes, shaMap));
    this.computedDisplayLog = displayLog;

    this.computeCommitsIndents(displayLog, shaMap, childrenMap);
    // this.computeStashesIndents(displayLog, childrenMap);

    // const displayLog = this.saveRowIndexIntoDisplayRef(this.appendStashes(commits, stashes, childrenMap));

    this.graphColumnCount = max(displayLog.map(c => c.indent!))! + 1;

    const edges = this.updateEdgeIntervals(displayLog, childrenMap);
    this.edges = edges;

    this.afterLogsComputed(gitRepository, displayLog, edges);
  }

  private onEveryRepositoryChanges = (gitRepository: GitRepository) => {
    // Sort branches by last commit date put on it => first branch is the one pointing to the last commit in date
    this.branches = gitRepository.branches;
  };

  private afterLogsComputed = (gitRepository: GitRepository, displayLog: DisplayRef[], edges: IntervalTree<Edge>) => {
    this.waitForCanvasToAppear.subscribe(canvasContext => {
      this.drawLog(canvasContext, displayLog, this.startCommit, edges);
      this.moveCanvasDown(this.startCommit);
      this.moveCommitWindow(canvasContext, this.startCommit);

      this.afterLogFirstDisplay(gitRepository);
    });
  }

  // Called after log is computed and computedDisplayLog is set (runs once)
  private afterLogFirstDisplay = once((gitRepository: GitRepository) => {

    // On first load, scroll down to last saved position
    this.logTableElement.scrollTo({top: gitRepository.startCommit * this.ROW_HEIGHT});

    const headPointedBranch = this.branches.find(b => b.isHeadPointed);
    if (headPointedBranch) this.selectAndScrollToCommit(headPointedBranch.tip.sha);

  });

  // Stashes are like commit => stash => stash
  private insertStashIntoCommits = (stash: DisplayRef, commits: DisplayRef[], shaMap: ShaMap) => {
    const parentSha = stashParentCommitSha(stash, shaMap);

    const parentCommitRow = commits.findIndex(c => c.sha == parentSha);

    // If we have merge commits above, we have a line starting from the parent commit, so we must move the stash upper
    const countMergeCommitsAbove = this.countMergeCommitsAbove(parentCommitRow, commits);

    const stashInsertionRow = parentCommitRow - countMergeCommitsAbove;

    // Insert stash into commitsLog, over its parent commit, and over merge commits
    commits.splice(stashInsertionRow, 0, stash);
  }

  private onTableScroll: EventListener = ({target}) => {
    this.startCommit = Math.floor((target as HTMLElement).scrollTop / this.ROW_HEIGHT);
    this.moveCommitWindow(this.canvasContext(), this.startCommit);
  }

  // Redraw the window of commits to display into log
  private moveCommitWindow = (canvas: CanvasRenderingContext2D, startCommit: number) => {
    this.moveCanvasDown(startCommit);
    this.drawLog(canvas, this.computedDisplayLog, startCommit, this.edges!);
  }

  private onTableScrollEnd: EventListener = ({target}) => {
    this.startCommit = Math.floor((target as HTMLElement).scrollTop / this.ROW_HEIGHT);
    this.gitRepositoryService.updateCurrentRepository({startCommit: this.startCommit}); // saveCurrentRepository doesn't trigger observers (whole panel refresh)
  }

  /**
   * Creates an interval tree with all the vertical connections between commits
   */
  private updateEdgeIntervals = (commitsLog: DisplayRef[], childrenMap: ChildrenMap) => {
    const edges = new IntervalTree<Edge>();

    commitsLog.forEach(commit => {

      const [parentRow, parentCol] = [commit.row!, commit.indent!];

      childrenMap[commit.sha]?.forEach(child => {
        const [childRow, childCol] = [child.row!, child.indent!];
        edges.insert(new Edge(childRow, childCol, parentRow, parentCol, child.summary, edgeType(child)));
      });
    });

    return edges;
  }

  private drawEdge = (canvas: CanvasRenderingContext2D, edge: Edge, startCommit: number) => {

    const topScroll = startCommit * this.ROW_HEIGHT;
    const [xParent, yParent] = [this.xPosition(edge.parentCol), this.yPosition(edge.parentRow) - topScroll];
    const [xChild, yChild] = [this.xPosition(edge.childCol), this.yPosition(edge.childRow) - topScroll];

    const isMergeCommit = edge.type == RefType.MERGE_COMMIT;
    this.prepareStyleForDrawingCommit(canvas, isMergeCommit ? edge.parentCol : edge.childCol);

    const isChildrenRight = xParent < xChild

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
   * Read commits top to bottom and style them (indentation & connections)
   * TODO: Cleanup this branch mess and use basic types provided by github-desktop, also clean the uniqBy
   */
  private commitToDisplayRef = (commit: Commit): DisplayRef => {
    const commitBranches = this.findCommitBranches(commit.branches) ?? [];

    return {
      ...commit,
      refType: RefType.COMMIT,
      isPointedByLocalHead: !!commitBranches.find(b => !b.name.includes('origin/') && b.isHeadPointed),
      branchesDetails: commitBranches,
    };
  };

  // TODO: Append stashes to logMatrix
  private stashToDisplayRef = (s: Stash): DisplayRef => ({
    ...s,
    refType: RefType.STASH,
    ref: '',
    isPointedByLocalHead: false,
    branchesDetails: [],
  });

  /**
   * @param commitBranches Branch objects pointing to this commit
   */
  private findCommitBranches = (commitBranches: string): Branch[] =>
    commitBranches
      .split(', ')
      .map(this.findBranchByRef)
      .filter(notUndefined)
      .filter(removeDuplicates);

  private findBranchByRef = (branchRef: string) => {
    if (branchRef.includes('origin/HEAD')) // Commit is pointed by remote head (usually origin/main)
      return this.branches.find(b => b.type == BranchType.Remote && b.isHeadPointed);
    else if (branchRef.includes('HEAD -> ')) // This commit is pointed by local HEAD, git tells which branch is pointed at. e.g: (HEAD -> branchPointedAt)
      return this.branches.find(byName(branchRef.replace('HEAD -> ', '')))

    return this.branches.find(byName(branchRef));
  };

  // Indent will be reused for future commits
  private computeCommitsIndents = (displayLog: DisplayRef[], shaMap: ShaMap, childrenMap: ChildrenMap) => {

    this.treeLockedColumn = undefined;
    this.columns = [];

    displayLog.forEach(commit => {
      commit.indent = this.computeCommitIndent(commit, shaMap, childrenMap);
      this.columns = this.columns.map(([status, count]) => [status, count + 1]);
    });
  };

  /**
   * Draw each commit / stash and their connections
   */
  private drawLog = (canvas: CanvasRenderingContext2D, displayLog: DisplayRef[], startCommit: number, edges: IntervalTree<Edge>) => {

    canvas.clearRect(0, 0, canvas.canvas.width, canvas.canvas.height);

    edges.search(startCommit, startCommit + this.COMMITS_SHOWN_ON_CANVAS)
      .forEach(edge => this.drawEdge(canvas, edge, startCommit))

    displayLog.slice(startCommit, startCommit + this.COMMITS_SHOWN_ON_CANVAS)
      .forEach((ref, indexForThisSlice) => this.drawNode(canvas, new Coordinates(indexForThisSlice, ref.indent!), ref));

    return canvas;
  };

  private countMergeCommitsAbove(startRow: number, commitsLog: DisplayRef[]) {
    for (let row = startRow - 1; row > 0; row--) {
      if (isMergeCommit(commitsLog[row])) continue;
      else return startRow - row - 1;
    }
    return 0;
  }

  private findFreeColumnForStash(stashInsertionRow: number, parentCommitRow: number, parentCommitCol: number, commitsLog: DisplayRef[], childrenMap: ChildrenMap) {
    const stashParentHasChildren = childrenMap[commitsLog[parentCommitRow].sha]?.length > 0;

    // Stash parent has no children, so there's room above it
    if (!stashParentHasChildren) return parentCommitCol;

    // Find another column to place our stash. Search on the left first for free space
    for (let col = parentCommitCol - 1; col >= 0; col--) {
      const commitAbove = this.findNextCommitAbove(stashInsertionRow, col, commitsLog);
      // Search the parents of the commit above our parentCommitRow. If found, get the row of the lowest one, it'll give us our free-range
      const parentOfCommitAbove = max(commitAbove?.parentSHAs.map(p => commitsLog.findIndex(c => c.sha == p))) ?? parentCommitRow;

      // If we have free room in this column, between the stash and its parent it's ok !
      if (stashInsertionRow > parentOfCommitAbove) return col;

    }

    // TODO: If no free columns are found on the left, then seek free columns on the right
    //   Also push a new column if no free column is found ?

    // No free column were found, we put the stash in the middle of a line.
    return parentCommitCol;
  }

  // TODO: move in a service ?
  private findNextCommitAbove(start: number, col: number, commitsLog: DisplayRef[]): DisplayRef | undefined {
    for (let row = start - 1; row > 0; row--) {
      if (commitsLog[row].indent == col) return commitsLog[row];
    }
    return undefined;
  }

  // Every commit from top (index=0) to bottom will be chosen a column (indent)
  private computeCommitIndent = (commit: DisplayRef, shaMap: ShaMap, childrenMap: ChildrenMap) => {

    if (commit.refType == RefType.INDEX) {
      const indent = this.pushNewColumn();
      shaMap[commit.parentSHAs[0]].indent = indent;
      return indent;
    }

    const children = (childrenMap[commit.sha] ?? []).filter(isCommit);
    // If commit has a child having current commit as first parent, we align with this commit
    const childrenOfSameBranch = children.filter(child => child.parentSHAs[0] == commit.sha);
    const leftChildOfSameBranch = childrenOfSameBranch.find(isMergeCommit) ?? childrenOfSameBranch[0]; // The children we align with
    let hasMergeChild = children.some(isMergeCommit);
    let distanceToNextMergeCommit = 0;
    let indent = -1;

    if (hasMergeChild) {
      const farthestMergeChild = children
        .filter(isMergeCommit)
        .sort((c1, c2) => c1.row! > c2.row! ? 1 : -1)[0];

      distanceToNextMergeCommit = commit.row! - farthestMergeChild.row!;
    }

    // If the commit has no parentSha => It is a tree root commit ! => It means that the following commits belong to another tree.
    // In order to indent commits for this new tree, we clear the saved commits refs and restart commits indentation from column 0
    if (isRootCommit(commit)) {

      // Lock starting column of the tree for the next tree (looks better)
      if (this.treeLockedColumn != undefined) this.setColumnFree(this.treeLockedColumn);

      this.treeLockedColumn = children[0].indent!;

      return children[0].indent!; // The column of a root commit will remain taken since it doesn't have a parent to free the column
    }

    if (children.length > 1 && leftChildOfSameBranch) {
      // Free all the children we don't align with
      this.freeChildrenColumns(children.filter(c => !isMergeCommit(c)), commit.indent ?? leftChildOfSameBranch.indent!);
    }

    if (isMergeCommit(commit)) {
      // Parents of current commit
      const parents = commit.parentSHAs.map(sha => shaMap[sha]).filter(notUndefined);

      // if there's no parents (In the bottom of log, parents could not be available), we just align with child
      if (!parents.length) return commit.indent ?? leftChildOfSameBranch?.indent ?? children[0].indent!;

      const firstParent = parents[0];

      // Skip the first parent because we will align the current commit with it !
      const otherParentsHavingOneChild = parents.slice(1);

      // For each parent we don't align with, we push a new column
      // This helps to hold the column taken till we reach the parent commit. It helps to make a continuous column with related commits (of the same branch most times)
      // It also helps to put all merge columns close to each other, [like this](docs/nice.png)
      otherParentsHavingOneChild
        .filter(otherParent => otherParent.indent == undefined)
        .forEach(otherParent => otherParent.indent = this.findFreeColumnOrPushNewColumn(-1));

      // Either the column of the commit has been determined by its parent ?? else, comes from his 'favorite' children (referencing this commit in parentSha[0]) ?? Else pushes a new column
      indent = commit.indent ?? leftChildOfSameBranch?.indent ?? this.findFreeColumnOrPushNewColumn(distanceToNextMergeCommit);

      firstParent.indent = indent;

      return indent;
    }

    // This commit have been positioned in a column by its merge children. We have to mark this column taken because the child didn't do it
    if (commit.indent != undefined) {
      this.columns[commit.indent] = ['taken', 0];
      return commit.indent;
    }

    // We have a parent to align to, column already taken
    if (leftChildOfSameBranch?.indent != undefined) return leftChildOfSameBranch?.indent;

    // We don't have child to align to => push a new column
    return this.findFreeColumnOrPushNewColumn(distanceToNextMergeCommit);
  }

  private freeChildrenColumns(childrenOfSameBranch: DisplayRef[], excludeThisColumn: number) {
    childrenOfSameBranch
      .filter(child => child.indent! != excludeThisColumn)
      .forEach(child => this.setColumnFree(child.indent!));
  }

// keep track of the states of the columns when drawing commits from top to bottom
  private findFreeColumnOrPushNewColumn = (neededFreeSpaceAbove = 0) => {
    const freeColumn = this.columns.findIndex(this.isColumnFree(neededFreeSpaceAbove + 1));

    if (freeColumn != -1) {
      this.columns[freeColumn] = ['taken', 0];
      return freeColumn;
    } else {
      return this.pushNewColumn();
    }
  }

  private isColumnFree = (neededFreeSpaceAbove: number) => ([status, spaceCount]: Column) => status == 'free' && spaceCount >= neededFreeSpaceAbove;

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
      const img = new Image();
      img.src = "/assets/images/chest.svg";
      img.onload = () => {
        canvas.drawImage(img, x - this.NODE_RADIUS, y - this.NODE_RADIUS, this.NODE_DIAMETER, this.NODE_DIAMETER);
      }
    }
  };

  private prepareForCommitTextDraw(canvas: CanvasRenderingContext2D) {
    canvas.beginPath();
    canvas.fillStyle = 'white';
    canvas.font = "normal 900 13.5px Roboto, sans-serif"; // Nunito not working here :/
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

  private saveRowIndexIntoDisplayRef = (log: DisplayRef[]) => log.map((c, i) => {
    c.row = i;
    return c;
  });

  private setColumnFree = (column: number) => {
    this.columns[column] = ['free', 0];
  };

  private insertStashesIntoCommits = (commits: DisplayRef[], stashes: DisplayRef[], shaMap: ShaMap) => {
    stashes.forEach(s => this.insertStashIntoCommits(s, commits, shaMap))
    return commits;
  };

  private pushNewColumn = () => this.columns.push(['taken', 0]) - 1;

  private computeStashesIndents = (displayLog: DisplayRef[], childrenMap: ChildrenMap) => {
    displayLog.filter(isStash).forEach(stash => {

      const parentCommitRow = displayLog.findIndex(c => stash.parentSHAs.includes(c.sha));
      const parentCommitCol = displayLog[parentCommitRow].indent!;

      // If we have merge commits above, we have a line starting from the parent commit, so we must move the stash upper
      const countMergeCommitsAbove = this.countMergeCommitsAbove(parentCommitRow, displayLog);

      const stashInsertionRow = parentCommitRow - countMergeCommitsAbove;
      // And place the stash inside on parent's column

      // Insert stash into displayLog, over its parent commit, and over merge commits
      stash.indent = this.findFreeColumnForStash(stashInsertionRow, parentCommitRow, parentCommitCol, displayLog, childrenMap);
    })
  };

  // Scroll view to display the selected commit
  private selectAndScrollToCommit = (sha: string) => {
    const indexCommitToSelect = this.computedDisplayLog.findIndex(bySha(sha));

    if (this.computedDisplayLog[indexCommitToSelect])
      this.selectedCommits.set([this.computedDisplayLog[indexCommitToSelect]]);

    if (!this.isOnView(indexCommitToSelect)) {
      this.waitForCanvasToAppear.subscribe(canvas => {
        const scrollToCommit = Math.max(Math.ceil(indexCommitToSelect - this.COMMITS_SHOWN_ON_CANVAS / 2), 0);
        this.moveCommitWindow(canvas, scrollToCommit);
        this.logTableElement.scrollTo({top: scrollToCommit * this.ROW_HEIGHT});
      });
    }
  }

  private isOnView = (commitIndex: number) =>
    commitIndex > this.startCommit && commitIndex < this.startCommit + this.COMMITS_SHOWN_ON_CANVAS;

  protected readonly remote = remote;
  protected readonly local = local;
  protected readonly commitColor = commitColor;
  protected readonly DATE_FORMAT = DATE_FORMAT;

}
