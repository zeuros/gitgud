import {AfterViewInit, Component, ElementRef, Input, ViewChild} from '@angular/core';
import {GitRepository} from '../../models/git-repository';
import {TableModule} from 'primeng/table';
import {DatePipe, JsonPipe, NgClass, NgForOf, NgIf, NgStyle} from '@angular/common';
import {Commit} from '../../models/commit';
import {RefType} from '../../enums/ref-type.enum';
import {notUndefined, removeDuplicates} from '../../utils/utils';
import {Stash} from '../../models/stash';
import {Branch, BranchType} from "../../models/branch";
import {byName} from "../../utils/log-utils";
import {DisplayRef} from "../../models/display-ref";
import {max, uniqBy} from "lodash";
import {buildChildrenMap, ChildrenMap, isCommit, isMergeCommit, isRootCommit} from "../../utils/commit-utils";
import {Coordinates} from "../../models/coordinates";
import {first, interval, map} from "rxjs";
import {IntervalTree} from "node-interval-tree";
import {Edge} from "../../models/edge";
import {GitRepositoryService} from "../../services/git-repository.service";
import {DragDropModule} from "primeng/dragdrop";

@Component({
  selector: 'gitgud-logs',
  standalone: true,
  imports: [
    TableModule,
    NgIf,
    DatePipe,
    NgForOf,
    JsonPipe,
    NgClass,
    NgStyle,
    DragDropModule,
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

  protected displayLog: DisplayRef[] = []; // Commits ready for display
  protected branches: ReadonlyArray<Branch> = []; // Local and distant branches
  protected graphColumnCount?: number;
  private treeCount = 0;
  private columns: ['taken' | 'free', count: number][] = []; // keep track of the states of the columns when drawing commits from top to bottom
  @ViewChild("canvas", {static: false}) private canvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild("logTable", {read: ElementRef}) private logTableRef?: ElementRef<HTMLElement>;
  private edges?: IntervalTree<Edge>;

  constructor(
    private gitRepositoryService: GitRepositoryService,
  ) {
  }

  @Input() set gitRepository(gitRepository: GitRepository) {

    if (!gitRepository.logs.length) return;

    // Sort branches by last commit date put on it => first branch is the one pointing to the last commit in date
    this.branches = gitRepository.branches;

    const commits = gitRepository.logs.map(this.commitToDisplayRef);
    const stashes = gitRepository.stashes.map(this.stashToDisplayRef);
    const childrenMap = buildChildrenMap([...commits, ...stashes]);

    this.computeCommitsIndents(commits, childrenMap);

    const displayLog = this.markRows(this.appendStashes(commits, stashes, childrenMap));

    this.graphColumnCount = max(displayLog.map(c => c.indent!))! + 1;

    const edges = this.updateEdgeIntervals(displayLog, childrenMap);

    this.waitForCanvasToAppear
      .subscribe(canvasContext => {
        this.logTable.scrollTo({top: gitRepository.startCommit * this.ROW_HEIGHT});
        this.moveCanvasDown(gitRepository.startCommit);
        this.drawLog(canvasContext, displayLog, gitRepository.startCommit, edges)
      })

    this.displayLog = displayLog;
    this.edges = edges;
  }

  get logTable() {
    return this.logTableRef!.nativeElement.querySelector(".p-datatable-wrapper")!
  }

  ngAfterViewInit() {
    this.logTable.addEventListener("scroll", this.onTableScroll);
  }

  protected branchName = (b: Branch) => b.name.replace('origin/', '');

  protected isPointedByHead = (d: DisplayRef) => d.isPointedByLocalHead;

  protected initials = (ref: DisplayRef) => ref.author.name.split(' ').slice(0, 2).map(e => e[0]).join('');

  protected xPosition = (col?: number) => this.NODE_RADIUS + (col ?? 0) * this.NODE_DIAMETER;

  protected yPosition = (row?: number) => this.NODE_RADIUS + (row ?? 0) * this.ROW_HEIGHT;

  protected indentColorFilter = (indent: number) => `hue-rotate(${indent * 360 / 7}deg)`;

  // TODO: show ghost branch on the left of commit if merged
  protected branchesAndRef = (displayLogElement: DisplayRef) =>
    uniqBy([...displayLogElement.branchesDetails/*, this.findBranchByRef(displayLogElement.ref)*/], 'branchesDetails.name');

  private onTableScroll: EventListener = ({target}) => {
    const startCommit = Math.floor((target as HTMLElement).scrollTop / this.ROW_HEIGHT);
    this.gitRepositoryService.modifyCurrentRepository({startCommit}, false);
    this.moveCanvasDown(startCommit);
    this.drawLog(this.canvasContext(), this.displayLog, startCommit, this.edges!);
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
        edges.insert(new Edge(childRow, childCol, parentRow, parentCol, child.summary, isMergeCommit(child) ? RefType.MERGE_COMMIT : RefType.COMMIT));
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
      branchesDetails: commitBranches.map(b => ({
        ...b,
        remote: !!commitBranches.find(b => b.name.includes('origin/')), // TODO: do it in view if short enough
        local: !!commitBranches.find(b => !b.name.includes('origin/')),
      })),
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
  private computeCommitsIndents = (displayLog: DisplayRef[], childrenMap: ChildrenMap) => {
    this.treeCount = 0;

    return displayLog.map(commit => {

      commit.indent = this.computeCommitIndent(commit, childrenMap);

      return commit;
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

  private appendStashes = (commitsLog: DisplayRef[], stashes: DisplayRef[], childrenMap: ChildrenMap) => {
    stashes.map(this.stashToDisplayRef).forEach(this.insertStashIntoLog(commitsLog, childrenMap));
    return commitsLog;
  };

  // Insert a stash into the commit log and display matrix
  private insertStashIntoLog = (commitsLog: DisplayRef[], childrenMap: ChildrenMap) => (stash: DisplayRef) => {
    const parentCommitRow = commitsLog.findIndex(c => stash.parentSHAs.includes(c.sha));
    const parentCommitCol = commitsLog[parentCommitRow].indent!;

    // If we have merge commits above, we have a line starting from the parent commit, so we must move the stash upper
    const countMergeCommitsAbove = this.countMergeCommitsAbove(parentCommitRow, commitsLog);

    const stashInsertionRow = parentCommitRow - countMergeCommitsAbove;
    // And place the stash inside on parent's column
    const stashCol = this.findFreeColumnForStash(stashInsertionRow, parentCommitRow, parentCommitCol, commitsLog, childrenMap);

    // Insert stash into commitsLog, over its parent commit, and over merge commits
    commitsLog.splice(stashInsertionRow, 0, {...stash, indent: stashCol});

  }

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

  private computeCommitIndent = (commit: DisplayRef, childrenMap: ChildrenMap) => {
    const children = (childrenMap[commit.sha] ?? []).filter(isCommit);

    if (!children.length) { // Top of a branch, has no children
      return this.findFreeColumnOrPushNewColumn(); // we return a free column from left to right (add one otherwise)
    }

    // If the commit has no parentSha => It is a tree root commit ! => It means that the following commits belong to another tree.
    // In order to indent commits for this new tree, we clear the saved commits refs and restart commits indentation from column 0
    if (isRootCommit(commit)) {
      this.treeCount++;
      this.columns = new Array(this.treeCount % 2).fill(['taken', 1]);
      return children[0].indent!;
    }

    // If commit has a child having current commit as first parent, we align with this commit
    const childToAlignWith = children.filter(child => child.parentSHAs[0] == commit.sha);

    if (childToAlignWith.length == 0) {
      return this.findFreeColumnOrPushNewColumn();
    }

    // Indent the commit with one if its children, on the leftest possible
    const indent = childToAlignWith[0].indent!;

    // Free all child columns that are not this commit's column, and have only one parent
    childrenMap[commit.sha]
      .filter(child => child.indent! != indent && child.parentSHAs[0] == commit.sha)
      .forEach(child => {
        this.setColumnFree(child.indent!);
      });

    return indent;

  }

  // keep track of the states of the columns when drawing commits from top to bottom
  private findFreeColumnOrPushNewColumn = () => {
    const freeColumn = this.columns.findIndex(c => c[0] == 'free');
    if (freeColumn != -1) {
      this.columns[freeColumn] = ['taken', 1];
      return freeColumn;
    } else {
      this.columns.push(['taken', 1]);
      return this.columns.length - 1;
    }
  }

  private drawNode(canvas: CanvasRenderingContext2D, commitCoordinates: Coordinates, ref: DisplayRef) {
    const [x, y] = [this.xPosition(commitCoordinates.col), this.yPosition(commitCoordinates.row)];

    this.prepareStyleForDrawingCommit(canvas, ref.indent!);

    if (isMergeCommit(ref)) {
      canvas.arc(x, y, this.NODE_RADIUS / 2.3, 0, 2 * Math.PI, true);
      canvas.fill();

      canvas.beginPath();
      canvas.arc(x, y, this.NODE_RADIUS / 1.4, 0, 2 * Math.PI, true);
      canvas.lineWidth = 2;
      canvas.stroke();
    } else if (isCommit(ref)) {
      canvas.arc(x, y, this.NODE_RADIUS, 0, 2 * Math.PI, true);
      canvas.fill();

      this.prepareForCommitTextDraw(canvas);
      canvas.fillText(this.initials(ref).toUpperCase(), x, y + 1);
      canvas.fill();
    } else { // Stash
      const img = new Image();
      img.src = "/assets/images/chest.svg";
      img.onload = () => {
        canvas.drawImage(img, x - this.NODE_RADIUS, y - this.NODE_RADIUS, this.NODE_DIAMETER, this.NODE_DIAMETER);
      }
    }
  }

  private prepareForCommitTextDraw(canvas: CanvasRenderingContext2D) {
    canvas.beginPath();
    canvas.fillStyle = 'white';
    canvas.font = "normal 900 13.5px Roboto, sans-serif"; // Nunito not working here :/
    canvas.textAlign = 'center';
    canvas.textBaseline = 'middle';
    canvas.shadowColor = 'rgba(0, 0, 0, 0.8)';
    canvas.shadowBlur = 3;
  }

  private prepareStyleForDrawingCommit(canvas: CanvasRenderingContext2D, indent: number) {
    canvas.beginPath();
    canvas.fillStyle = canvas.strokeStyle = 'rgba(206, 147, 216, 0.9)';
    canvas.filter = this.indentColorFilter(indent);
    canvas.shadowColor = 'rgba(0, 0, 0, 0.8)';
    canvas.shadowBlur = 10;
  }

  private canvasContext = () => this.canvas?.nativeElement?.getContext('2d')!;

  // Canvas appears in the first row of the table, I don't know how to do it properly
  private waitForCanvasToAppear = interval(20).pipe(map(this.canvasContext), first(notUndefined));

  private moveCanvasDown = (startCommit: number) => this.canvas!.nativeElement.style.top = `${startCommit * this.ROW_HEIGHT}px`;

  private markRows = (log: DisplayRef[]) => log.map((c, i) => {
    c.row = i;
    return c;
  })

  private setColumnFree = (column: number) => {
    this.columns[column] = ['free', this.columns[column] ? (this.columns[column][1] + 1) : 0];
  }
}
