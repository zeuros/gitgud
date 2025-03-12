import {AfterViewInit, Component, ElementRef, Input, ViewChild} from '@angular/core';
import {GitRepository} from '../../models/git-repository';
import {TableModule} from 'primeng/table';
import {DatePipe, JsonPipe, NgClass, NgForOf, NgIf} from '@angular/common';
import {Commit} from '../../models/commit';
import {RefType} from '../../enums/ref-type.enum';
import {notUndefined, removeDuplicates} from '../../utils/utils';
import {Stash} from '../../models/stash';
import {Branch, BranchType} from "../../models/branch";
import {byName, bySha} from "../../utils/log-utils";
import {DisplayRef} from "../../models/display-ref";
import {max} from "lodash";
import {buildChildrenMap, ChildrenMap, isMergeCommit, isRootCommit} from "../../utils/commit-utils";
import {Coordinates} from "../../models/coordinates";
import {first, interval, map} from "rxjs";

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
  protected readonly COMMITS_SHOWN_ON_CANVAS = 45;


  protected displayLog: DisplayRef[] = []; // Commits ready for display
  protected branches: ReadonlyArray<Branch> = []; // Local and distant branches
  protected graphColumnCount?: number;
  protected removeDuplicates = removeDuplicates;
  private columns: ('taken' | 'free')[] = []; // keep track of the states of the columns when drawing commits from top to bottom
  @ViewChild("canvas", {static: false}) private canvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild("logTable", {read: ElementRef}) private logTable?: ElementRef<HTMLElement>;
  private childrenMap?: ChildrenMap;

  @Input() set gitRepository(gitRepository: GitRepository) {

    if (!gitRepository.logs.length) return;

    // Sort branches by last commit date put on it => first branch is the one pointing to the last commit in date
    this.branches = gitRepository.branches;

    const commitsLog = gitRepository.logs.map(this.commitToDisplayRef);

    // TODO: refacto
    const childrenMap = buildChildrenMap(commitsLog);

    this.computeCommitsIndents(commitsLog, childrenMap);

    const displayLog = this.appendStashes(commitsLog, gitRepository.stashes, childrenMap);

    this.graphColumnCount = max(commitsLog.map(c => c.indent!))! + 1;

    this.waitForCanvasToAppear
      .subscribe(canvasContext => this.drawLog(canvasContext, displayLog, 0, childrenMap!))

    this.displayLog = displayLog;
    this.childrenMap = childrenMap;
  }

  ngAfterViewInit() {
    this.logTable!.nativeElement
      .querySelector(".p-datatable-wrapper")!
      .addEventListener("scroll", ({target}) => this.scrollCanvasCommits((target as HTMLElement).scrollTop));
  }

  protected branchName = (b: Branch) => b.name.replace('origin/', '');

  protected isPointedByHead = (d: DisplayRef) => d.branchDetails?.isPointedByLocalHead;

  protected refContents = (ref: DisplayRef) => isMergeCommit(ref) || ref.refType == RefType.STASH ? '' : ref.author.name.slice(0, 1);
  protected xPosition = (col?: number) => this.NODE_RADIUS + (col ?? 0) * this.NODE_DIAMETER;
  protected yPosition = (row?: number) => this.NODE_RADIUS + (row ?? 0) * this.ROW_HEIGHT;

  private drawEdgesBetweenTwoCommits = (canvas: CanvasRenderingContext2D, parent: Coordinates, child: Coordinates, parentRef: DisplayRef, childRef: DisplayRef) => {

    const [xParent, yParent] = [this.xPosition(parent.col), this.yPosition(parent.row)];
    const [xChild, yChild] = [this.xPosition(child.col), this.yPosition(child.row)];


    this.prepareStyleForDrawingCommit(canvas, isMergeCommit(childRef) ? parentRef : childRef);

    const isChildrenRight = xParent < xChild

    if (isMergeCommit(childRef)) {
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
      // if (isChildrenRight) {
      //   canvas.lineTo(xParent, yChild - this.NODE_RADIUS);
      //   canvas.quadraticCurveTo(xParent, yChild, xParent + this.NODE_RADIUS, yChild);
      // } else {
      //   canvas.lineTo(xParent, yChild - this.NODE_RADIUS);
      //   canvas.quadraticCurveTo(xParent, yChild, xParent - this.NODE_RADIUS, yChild);
      // }
    }
    canvas.stroke();

    // Connections between successive commits on same column
    // if (parent.col == child.col) { // Successive commits: Just connect them and the gaps between them
    //   logMatrix[parent.row][parent.col] = [...logMatrix[parent.row][parent.col], new CellContent(VERTICAL_TOP, child.col)];
    //
    //   // Draw vertical lines from parent to child
    //   for (let rowIndex = parent.row - 1; rowIndex > child.row; rowIndex--) {
    //     logMatrix[rowIndex][child.col] = [...logMatrix[rowIndex][child.col], new CellContent(VERTICAL, child.col)];
    //   }
    // }
    //
    // // Draw the little connection of the child to the line coming from its parent
    // logMatrix[child.row][child.col] = [...logMatrix[child.row][child.col], new CellContent(VERTICAL_BOTTTOM, child.col)];
    //
    // // Draw the horizontal line between parent -> child columns at parent row like '---(c)  if parent is on different column
    // if (parent.col != child.col) {
    //   if (isChildrenRight) {
    //     for (let col = parent.col + 1; col < child.col; col++) {
    //       logMatrix[parent.row][col] = [...logMatrix[parent.row][col], new CellContent(HORIZONTAL, child.col)];
    //     }
    //   } else {
    //     for (let col = parent.col - 1; col > child.col; col--) {
    //       logMatrix[parent.row][col] = [...logMatrix[parent.row][col], new CellContent(HORIZONTAL, child.col)];
    //     }
    //   }
    //
    //   // If parent and child are in different columns, we need to draw a turn. Draw the turns at each end
    //   if (isMergeCommit(childCommit)) { // Draw [Edge to merge children](https://pvigier.github.io/media/img/commit-graph/design_straight_branches/first_parent.svg)
    //     const turnSymbol = isChildrenRight ? UP_RIGHT:UP_LEFT;
    //     logMatrix[child.row][parent.col] = [...logMatrix[parent.row][child.col], new CellContent(turnSymbol, parent.col)]; // Turn to child
    //
    //     // Draw horizontal line from turn to child TODO: test this
    //     const colDirection = isChildrenRight ? 1 : -1;
    //     for (let colIndex = parent.col + colDirection; colIndex != child.col; colIndex += colDirection) {
    //       logMatrix[child.row][colIndex] = [...logMatrix[child.row][colIndex], new CellContent(HORIZONTAL, parent.col)];
    //     }
    //
    //   } else { // Draw [Edge to branch children](https://pvigier.github.io/media/img/commit-graph/design_straight_branches/other_parent.svg)
    //     if (isChildrenRight) {
    //       logMatrix[parent.row][child.col] = [...logMatrix[parent.row][child.col], new CellContent(RIGHT_UP, child.col)]; // Turn to child
    //     } else { // Child is to the left of parent
    //       logMatrix[parent.row][child.col] = [...logMatrix[parent.row][child.col], new CellContent(LEFT_UP, child.col)]; // Turn to child
    //     }
    //
    //     // Draw vertical line from child turn to child
    //     for (let rowIndex = parent.row - 1; rowIndex > child.row; rowIndex--) {
    //       logMatrix[rowIndex][child.col] = [...logMatrix[rowIndex][child.col], new CellContent(VERTICAL, child.col)];
    //     }
    //   }

    // }
  };

  /**
   * Read commits top to bottom and style them (indentation & connections)
   * TODO: Create a matrix with the drawn commits, links between them, etc...
   */
  private commitToDisplayRef = (commit: Commit): DisplayRef => {
    // Find branches pointing to this commit
    const commitBranches = this.findCommitBranches(commit.branches)

    return {
      ...commit,
      refType: RefType.COMMIT,
      // Fix stash commit date not being at the real stash date.
      // committer: refType == RefType.STASH ? this.findStash(commit.sha)!.committer : commit.committer,
      branchDetails: commitBranches.length ? {
        // This commit is pointed by origin branch (starts with origin/). Shows the [gitHub] icon
        remote: !!commitBranches.find(b => b.name.includes('origin/')), // TODO: do it in view if short enough
        // This commit is pointed by a local branch. Shows the 💻 icon
        local: !!commitBranches.find(b => !b.name.includes('origin/')),
        // This commit is pointed by HEAD, preselect the commit line, and add the 💻 icon
        isPointedByLocalHead: !!commitBranches.find(b => !b.name.includes('origin/') && b.isHeadPointed),
        branches: commitBranches,
      } : undefined,
    };
  };

  // TODO: Append stashes to logMatrix
  private stashToDisplayRef = (s: Stash): DisplayRef => ({
    ...s,
    refType: RefType.STASH,
    ref: '',
    branchDetails: {
      branches: [],
      isPointedByLocalHead: false,
      local: false,
      remote: false
    },
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

  // Matrix with just commits inside
  private computeCommitsIndents = (displayLog: DisplayRef[], childrenMap: ChildrenMap) =>
    displayLog.map(commit => {
      // Indent will be reused for future commits
      commit.indent = this.computeCommitIndent(commit, childrenMap);
      return commit;
    });

  /**
   * Draw each commit / stash and their connections
   */
  private drawLog = (canvas: CanvasRenderingContext2D, displayLog: DisplayRef[], startCommit: number, childrenMap: ChildrenMap) => {

    canvas.clearRect(0, 0, canvas.canvas.width, canvas.canvas.height);

    const scrollTop = startCommit * this.ROW_HEIGHT;

    displayLog.slice(startCommit, startCommit + this.COMMITS_SHOWN_ON_CANVAS).forEach((ref, index) => { // Starts with the bottom commit, bottom index

      const commitCoordinates = new Coordinates(index, ref.indent!);
      if (ref.refType == RefType.STASH) {
        const stashParentRow = displayLog.findIndex(c => ref.parentSHAs.includes(c.sha));
        commitCoordinates.col = displayLog[stashParentRow].indent!;
        // this.drawNode(canvas, commitCoordinates, ref);
        //   const parentCoordinates = new Coordinates(stashParentRow, displayLog[stashParentRow].indent!);
        //   this.drawEdgesBetweenTwoCommits(canvas, parentCoordinates, commitCoordinates, ref);
      } else { // RefType.COMMIT
        this.drawNode(canvas, commitCoordinates, ref);
        // Draw commit connection with its children
        childrenMap[ref.sha]?.forEach(child => {

          const childRow = displayLog.findIndex(bySha(child.sha));
          const childCoordinates = new Coordinates(childRow - startCommit, displayLog[childRow].indent!);

          // Draw connection between parent and children
          this.drawEdgesBetweenTwoCommits(canvas, commitCoordinates, childCoordinates, ref, child);
        });
      }


    });


    return canvas;
  };

  private appendStashes = (commitsLog: DisplayRef[], stashes: ReadonlyArray<Commit>, childrenMap: ChildrenMap) => {
    stashes.map(this.stashToDisplayRef).forEach(this.insertStashIntoLog(commitsLog, childrenMap));
    return commitsLog;
  }

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

    const children = childrenMap[commit.sha] ?? [];

    if (!children.length) { // Top of a branch, has no children
      return this.findFreeColumnOrPushNewColumn(); // we return a free column from left to right (add one otherwise)
    }

    // If the commit has no parentSha => It is a tree root commit ! => It means that the following commits belong to another tree.
    // In order to indent commits for this new tree, we clear the saved commits refs and restart commits indentation from column 0
    if (isRootCommit(commit)) {
      this.columns = [];
      return children[0].indent!;
    }

    // If commit has a child having current commit as first parent, we align with this commit
    const childToAlignWith = children.filter(child => child.parentSHAs[0] == commit.sha);

    if (childToAlignWith.length == 0) {
      return this.findFreeColumnOrPushNewColumn();
    }

    if (childToAlignWith.length == 1) {
      return childToAlignWith[0].indent!
    } else {
      // Save children commit on the left
      const leftCol = childToAlignWith[0].indent!;

      // Free all child columns but the leftest
      childrenMap[commit.sha]
        .filter(child => child.indent! != leftCol)
        .forEach(child => {
          this.columns[child.indent!] = 'free';
        });

      return leftCol;
    }

  }

  // keep track of the states of the columns when drawing commits from top to bottom
  private findFreeColumnOrPushNewColumn = () => {
    const freeColumn = this.columns.indexOf('free');
    if (freeColumn != -1) {
      this.columns[freeColumn] = 'taken';
      return freeColumn;
    } else {
      this.columns.push('taken');
      return this.columns.length - 1;
    }
  }

  private drawNode(canvas: CanvasRenderingContext2D, commitCoordinates: Coordinates, ref: DisplayRef) {
    const [x, y] = [this.xPosition(commitCoordinates.col), this.yPosition(commitCoordinates.row)];

    this.prepareStyleForDrawingCommit(canvas, ref);

    if (isMergeCommit(ref)) {
      canvas.arc(x, y, this.NODE_RADIUS / 2, 0, 2 * Math.PI, true);
      canvas.fill();

      canvas.beginPath();
      canvas.arc(x, y, this.NODE_RADIUS, 0, 2 * Math.PI, true);
      canvas.lineWidth = 2;
      canvas.stroke();
    } else if (ref.refType == RefType.COMMIT) {
      canvas.arc(x, y, this.NODE_RADIUS, 0, 2 * Math.PI, true);
      canvas.fill();

      this.prepareForCommitTextDraw(canvas);
      canvas.fillText(this.refContents(ref).toUpperCase(), x, y + 1);
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
    canvas.font = "normal 900 14px Roboto, sans-serif"; // Nunito not working here :/
    canvas.textAlign = 'center';
    canvas.textBaseline = 'middle';
    canvas.shadowColor = 'rgba(0, 0, 0, 0.8)';
    canvas.shadowBlur = 3;
  }

  private prepareStyleForDrawingCommit(canvas: CanvasRenderingContext2D, ref: DisplayRef) {
    canvas.beginPath();
    canvas.fillStyle = canvas.strokeStyle = 'rgba(206, 147, 216, 0.9)';
    canvas.filter = `hue-rotate(${ref.indent! * 360 / 7}deg)`;
    canvas.shadowColor = 'rgba(0, 0, 0, 0.8)';
    canvas.shadowBlur = 10;
  }

  private canvasContext = () => this.canvas?.nativeElement?.getContext('2d')!;
  // Canvas appears in the first row of the table, I don't know how to do it properly
  private waitForCanvasToAppear = interval(20).pipe(map(this.canvasContext), first(notUndefined));

  private scrollCanvasCommits = (scrollTop: number) => {
    const startCommit = Math.floor(scrollTop / this.ROW_HEIGHT);

    this.canvas!.nativeElement.style.top = `${startCommit * this.ROW_HEIGHT}px`;

    this.drawLog(this.canvasContext(), this.displayLog, startCommit, this.childrenMap!);
  }
}
