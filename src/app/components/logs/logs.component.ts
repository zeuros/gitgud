import {Component, Input} from '@angular/core';
import {GitRepository} from '../../models/git-repository';
import {TableModule} from 'primeng/table';
import {DatePipe, JsonPipe, NgClass, NgForOf, NgIf} from '@angular/common';
import {Commit} from '../../models/commit';
import {RefType} from '../../enums/ref-type.enum';
import {notUndefined, notZero, rangesOverlap, removeDuplicates, reversedForEach} from '../../utils/utils';
import {Stash} from '../../models/stash';
import {Branch, BranchType} from "../../models/branch";
import {byName, bySha, cellContainsCommit, findParentCommit, isDisplayRef, isLogMatrixSymbol} from "../../utils/log-utils";
import {DisplayRef} from "../../models/display-ref";
import {max, min} from "lodash";
import {buildChildrenMap, buildCommitMap, ChildrenMap, CommitMap, hasNoBranching, isMergeCommit, isMergeRef, isRootCommit} from "../../utils/commit-utils";
import {Coordinates} from "../../models/coordinates";
import {CellContent, LogMatrix, LogMatrixSymbol, Row} from "../../models/log-matrix";


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
export class LogsComponent {

  protected displayLog: DisplayRef[] = []; // Commits ready for display
  protected branches: ReadonlyArray<Branch> = []; // Local and distant branches
  protected readonly removeDuplicates = removeDuplicates;
  protected drawMatrix: LogMatrix = [[]];
  protected logMatrixSymbolClasses: { [s in LogMatrixSymbol]: string } = {
    [LogMatrixSymbol.HORIZONTAL]: 'horizontal',
    [LogMatrixSymbol.VERTICAL]: 'vertical full',
    [LogMatrixSymbol.VERTICAL_TOP]: 'vertical top',
    [LogMatrixSymbol.VERTICAL_BOTTTOM]: 'vertical bottom',
    [LogMatrixSymbol.LEFT_UP]: 'turn left-up',
    [LogMatrixSymbol.RIGHT_UP]: 'turn right-up',
    [LogMatrixSymbol.UP_RIGHT]: 'turn up-right',
    [LogMatrixSymbol.UP_LEFT]: 'turn up-left'
  };
  protected readonly isDisplayRef = isDisplayRef;
  protected readonly notZero = notZero;
  protected readonly isLogMatrixSymbol = isLogMatrixSymbol;
  private commitMap: CommitMap = {};
  private childrenMap: ChildrenMap = {};

  @Input() set gitRepository(gitRepository: GitRepository) {

    if (!gitRepository.logs.length) return;

    // Sort branches by last commit date put on it => first branch is the one pointing to the last commit in date
    this.branches = gitRepository.branches;

    this.commitMap = buildCommitMap(gitRepository.logs);

    this.childrenMap = buildChildrenMap(gitRepository.logs);

    this.displayLog = gitRepository.logs.map(this.commitToDisplayRef);

    const commitMatrix = this.clearEmptyColumns(this.packColumns(this.clearEmptyColumns(this.buildCommitMatrix(this.displayLog))));

    this.drawMatrix = this.addConnectionLines(this.appendStashes(this.fromCommitMatrix(commitMatrix), gitRepository.stashes), this.displayLog);

  }

  protected branchName = (b: Branch) => b.name.replace('origin/', '');

  protected isPointedByHead = (d: DisplayRef) => d.branchDetails?.isPointedByLocalHead;

  protected displayRefClass = (ref: DisplayRef) => {
    if (ref.refType == RefType.STASH) return 'stash';
    if (isMergeRef(ref)) return 'le-dot';
    return 'user-name-bubble';
  }

  protected refContents = (ref: DisplayRef) => isMergeRef(ref) || ref.refType == RefType.STASH ? '' : ref.author.name.slice(0, 1);

  private computeCommitIndentation = (displayRef: DisplayRef | Commit, allRefs: string[]) => {

    // get raw ref related to our commit (the branch it has been committed with) and match corresponding local branch
    // Group commits by their local branch (one column = one local branch) ...
    const refLocalBranch = this.findLocalRef(displayRef.ref);
    const refLocalBranchIndex = allRefs.indexOf(refLocalBranch);

    // We merge the local & remote branches to put them on the same column (meaning commits of the same local branch have the same indentation)
    return refLocalBranchIndex >= 0 ? refLocalBranchIndex : (allRefs.push(refLocalBranch) - 1);
  }

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

  // For a given ref (thing, origin/thing, HEAD), finds the corresponding local branch if available
  private findLocalRef = (ref: string) => {
    ref = this.followHeadPointer(ref);

    // We merge the ref to remote branch, returns the local equivalent if available
    if (ref.includes('origin/'))
      return this.branches.find(byName(ref.replace('origin/', '')))?.name ?? ref.replace('origin/', '');

    // Else it's a local ref, or a ref of a disappeared branch
    return ref;
  };

  private followHeadPointer = (ref: string) => {
    if (ref.includes('origin/HEAD')) // Follow HEAD pointer to the actual remote branch
      return this.branches.find(b => b.type == BranchType.Remote && b.isHeadPointed)?.name ?? ref;
    else if (ref.includes('HEAD -> ')) // This commit is pointed by local HEAD, git tells which branch is pointed at. e.g: (HEAD -> branchPointedAt)
      return this.branches.find(byName(ref.replace('HEAD -> ', '')))?.name ?? ref
    else if (ref == 'HEAD')
      return this.branches.find(b => b.type == BranchType.Local && b.isHeadPointed)?.name ?? ref;

    return ref;
  };

  // Matrix with just commits inside
  private buildCommitMatrix = (displayLog: DisplayRef[]): DisplayRef[][] => {

    const commitsIndents = this.computeCommitsIndents(displayLog);

    const columnCount = max(commitsIndents)! + 1;

    return displayLog.map((commit, i) => {
      // Create new row
      const row = new Array(columnCount).fill(undefined);

      const commitColumn = commitsIndents[i];

      // Draw current commit
      row[commitColumn] = commit;

      return row;
    });
  };

  private computeCommitsIndents(displayLog: DisplayRef[]) {

    let refs: string[] = [];

    return displayLog.map(commit => {

      // If the commit has no parentSha => It is a tree root commit ! => It means that the next commits belong to another tree.
      // In order to indent commits for this new tree, we clear the saved commits refs and restart commits indentation
      if (isRootCommit(commit)) {
        const childIndent = this.computeCommitIndentation(this.childrenMap[commit.sha][0], refs);
        refs = []; // Clear branches related to the tree to restart indent from 0
        return childIndent;
      }

      const hasOneChild = this.childrenMap[commit.sha]?.length == 1;

      // TODO: move this optimization into dedicated function
      // If this commit has not branching above (all children aligned), align it with its children.
      if (hasOneChild && hasNoBranching(commit, this.childrenMap))
        return this.computeCommitIndentation(this.childrenMap[commit.sha][0], refs);

      return this.computeCommitIndentation(commit, refs);
    });
  }

  private clearEmptyColumns = (buildLogMatrix: DisplayRef[][]) => {
    // Find columns that contain no commits
    buildLogMatrix[0]
      .map((_, colIndex) => buildLogMatrix.every(row => row[colIndex] == undefined) ? colIndex : undefined)
      .filter(notUndefined) // We have a list of empty columns
      .forEach(emptyColumn => {
        for (let row = 0; row < buildLogMatrix.length; row++) {
          delete buildLogMatrix[row][emptyColumn];
        }
      });

    return buildLogMatrix;
  };

  // TODO: test it thoroughly
  /**
   * Reads commits bottom to top and draw each commits edges (branches and merges)
   * @param drawMatrix a matrix filled with commits only (yet)
   * @param displayLog
   */
  private addConnectionLines = (drawMatrix: LogMatrix, displayLog: DisplayRef[]) => {

    // For each commit starting from root commit (bottom of the log)
    reversedForEach(displayLog, (ref, indexFromBottom) => { // Starts with the bottom commit, bottom index

      const commitCoordinates = new Coordinates(indexFromBottom, drawMatrix[indexFromBottom].findIndex(cellContainsCommit));

      if (ref.refType == RefType.STASH) {
        const stashParentRow = this.displayLog.findIndex(c => ref.parentSHAs.includes(c.sha));
        const parentCoordinates = new Coordinates(stashParentRow, drawMatrix[stashParentRow].findIndex(cellContainsCommit));
        this.drawTwoCommitsConnection(parentCoordinates, commitCoordinates, drawMatrix, ref);
      } else {
        // Draw commit connection with its children
        this.childrenMap[ref.sha]?.forEach(child => {

          const childRow = displayLog.findIndex(bySha(child.sha));
          const childCoordinates = new Coordinates(childRow, drawMatrix[childRow].findIndex(cellContainsCommit));

          // Draw connection between parent and children
          this.drawTwoCommitsConnection(commitCoordinates, childCoordinates, drawMatrix, child);
        });
      }


    });


    return drawMatrix;
  };

  private drawTwoCommitsConnection = (parent: Coordinates, child: Coordinates, logMatrix: LogMatrix, childCommit: Commit | DisplayRef) => {

    const isChildrenRight = parent.col < child.col; // Determine the direction of the connection

    // Connections between successive commits on same column
    if (parent.col == child.col) { // Successive commits: Just connect them and the gaps between them
      logMatrix[parent.row][parent.col] = [...logMatrix[parent.row][parent.col], new CellContent(LogMatrixSymbol.VERTICAL_TOP, child.col)];

      // Draw vertical lines from parent to child
      for (let rowIndex = parent.row - 1; rowIndex > child.row; rowIndex--) {
        logMatrix[rowIndex][child.col] = [...logMatrix[rowIndex][child.col], new CellContent(LogMatrixSymbol.VERTICAL, child.col)];
      }
    }

    // Draw the little connection of the child to the line coming from its parent
    logMatrix[child.row][child.col] = [...logMatrix[child.row][child.col], new CellContent(LogMatrixSymbol.VERTICAL_BOTTTOM, child.col)];

    // Draw the horizontal line between parent -> child columns at parent row like '---(c)  if parent is on different column
    if (parent.col != child.col) {
      if (isChildrenRight) {
        for (let col = parent.col + 1; col < child.col; col++) {
          logMatrix[parent.row][col] = [...logMatrix[parent.row][col], new CellContent(LogMatrixSymbol.HORIZONTAL, child.col)];
        }
      } else {
        for (let col = parent.col - 1; col > child.col; col--) {
          logMatrix[parent.row][col] = [...logMatrix[parent.row][col], new CellContent(LogMatrixSymbol.HORIZONTAL, child.col)];
        }
      }

      // If parent and child are in different columns, we need to draw a turn. Draw the turns at each end
      if (childCommit instanceof Commit && isMergeCommit(childCommit)) { // Draw [Edge to merge children](https://pvigier.github.io/media/img/commit-graph/design_straight_branches/first_parent.svg)
        const turnSymbol = isChildrenRight ? LogMatrixSymbol.UP_RIGHT : LogMatrixSymbol.UP_LEFT;
        logMatrix[child.row][parent.col] = [...logMatrix[parent.row][child.col], new CellContent(turnSymbol, parent.col)]; // Turn to child

        // Draw horizontal line from turn to child TODO: test this
        const colDirection = isChildrenRight ? 1 : -1;
        for (let colIndex = parent.col + colDirection; colIndex != child.col; colIndex += colDirection) {
          logMatrix[child.row][colIndex] = [...logMatrix[child.row][colIndex], new CellContent(LogMatrixSymbol.HORIZONTAL, parent.col)];
        }

      } else { // Draw [Edge to branch children](https://pvigier.github.io/media/img/commit-graph/design_straight_branches/other_parent.svg)
        if (isChildrenRight) {
          logMatrix[parent.row][child.col] = [...logMatrix[parent.row][child.col], new CellContent(LogMatrixSymbol.RIGHT_UP, child.col)]; // Turn to child
        } else { // Child is to the left of parent
          logMatrix[parent.row][child.col] = [...logMatrix[parent.row][child.col], new CellContent(LogMatrixSymbol.LEFT_UP, child.col)]; // Turn to child
        }

        // Draw vertical line from child turn to child
        for (let rowIndex = parent.row - 1; rowIndex > child.row; rowIndex--) {
          logMatrix[rowIndex][child.col] = [...logMatrix[rowIndex][child.col], new CellContent(LogMatrixSymbol.VERTICAL, child.col)];
        }
      }

    }
  };

  // move columns of successive commits onto another column in order to save column space if possible
  private packColumns = (commitMatrix: DisplayRef[][]) => {
    const lastColumn = commitMatrix[0].length - 1;

    // Check if the first column is available to welcome sequences of commits of the last column
    for (let sourceCol = lastColumn; sourceCol > 0; sourceCol--) { // Browse columns last to second
      for (const rowRange of this.sequencesOfCommitsRanges(commitMatrix, sourceCol)) {
        for (let destCol = 0; destCol < lastColumn; destCol++) { // Browse columns first to N
          if (this.rangeIsFree(destCol, rowRange, commitMatrix)) {
            // Move commits from source col to dest col on given range
            this.moveCommits(rowRange, sourceCol, destCol, commitMatrix);
          }

        }
      }
    }

    return commitMatrix;
  }

  /**
   * For a given column, return lists of successive commits. Returns the rows ranges of these commits
   * Also adds the parent of each commit list ranges into the range
   */
  private sequencesOfCommitsRanges = (commitMatrix: DisplayRef[][], col: number) => {

    const columnCommitRows = this.columnCommitRows(commitMatrix, col);
    const columnCommits = columnCommitRows.map(commitRow => commitMatrix[commitRow][col] as DisplayRef);

    const sequences: [startRow: number, endRow: number][] = [];
    let currentSequence = [];

    for (let i = 0; i < columnCommits.length; i++) {
      const nextCommitSha = i < columnCommits.length - 1 ? columnCommits[i + 1].sha : undefined;

      // skip merge commits
      if (isMergeRef(columnCommits[i])) continue;

      // Add current commit row to current sequence
      currentSequence.push(columnCommitRows[i]);

      // If next commit is parent and on same column, continue building the sequence
      if (nextCommitSha && columnCommits[i].parentSHAs.includes(nextCommitSha)) {
        continue;
      } else {
        // Push the row of the parent of the commit, we obtain the range of rows to free (including their connections with parent)
        const parentCommitRow = this.displayLog.findIndex(e => e.sha == this.commitMap[columnCommits[i].parentSHAs[0]]?.sha)
        sequences.push([min(currentSequence)!, parentCommitRow]);
        currentSequence = []; // Restart a sequence for next commits in column.
      }
    }

    return sequences;
  }

  // Return rows of the column containing a commit
  private columnCommitRows = (logMatrix: DisplayRef[][], col: number) => {
    const columnCommits = [];

    for (let row = 0; row < logMatrix.length - 1; row++) {
      if (logMatrix[row][col] != undefined) {
        columnCommits.push(row);
      }
    }

    return columnCommits;
  }

  // Transforms commit matrix into elements to draw matrix
  private fromCommitMatrix = (commitMatrix: DisplayRef[][]): LogMatrix => {

    const columnCount = commitMatrix[0].length;

    return commitMatrix.map((_, rowIndex) => {
      // Create new row
      const row: Row = new Array(columnCount).fill([]);

      const commitColumn = commitMatrix[rowIndex].findIndex(notUndefined);

      // Put commit into drawMatrix
      row[commitColumn] = [new CellContent(commitMatrix[rowIndex].find(notUndefined)!, commitColumn)];

      return row;
    });
  }

  // If no commit or commit line is found on this range, return true
  private rangeIsFree = (destCol: number, [startRow, endRow]: [number, number], commitMatrix: DisplayRef[][]) => {
    // No commits on the range ?
    for (let row = startRow; row < endRow; row++) {
      if (commitMatrix[row][destCol] != undefined)
        return false;
    }

    // Find the first commit over the range
    let firstCommitOverTheRange = this.findFirstCommitOverRow(startRow, destCol, commitMatrix);

    if (firstCommitOverTheRange != undefined) {
      const parentCommitRow = this.displayLog.findIndex(bySha(firstCommitOverTheRange.parentSHAs[0]))
      return !rangesOverlap([startRow, endRow], [this.displayLog.findIndex(bySha(firstCommitOverTheRange.sha)), parentCommitRow]);
    }

    // No commit over the range, so no line passing by, range is free
    return true;

  }

  private findFirstCommitOverRow = (startRow: number, destCol: number, commitMatrix: DisplayRef[][]) => {
    for (let row = startRow; row > 0; row--) {
      if (commitMatrix[row][destCol] != undefined) return commitMatrix[row][destCol];
    }
    return undefined;
  }

  private moveCommits = ([rowStart, rowEnd]: [number, number], sourceCol: number, destCol: number, commitMatrix: DisplayRef[][]) => {
    for (let row = rowStart; row < rowEnd - 1; row++) {
      if (commitMatrix[row][sourceCol] != undefined) {
        commitMatrix[row][destCol] = commitMatrix[row][sourceCol];
        commitMatrix[row][sourceCol] = undefined as unknown as DisplayRef;
      }
    }
  }

  private appendStashes = (logMatrix: LogMatrix, stashes: ReadonlyArray<Commit>) => {
    stashes.map(this.stashToDisplayRef).forEach(this.insertStashIntoLog(logMatrix));
    return logMatrix;
  }

  // Insert a stash into the commit log and display matrix
  private insertStashIntoLog = (logMatrix: LogMatrix) => (stash: DisplayRef) => {
    const parentCommitRow = this.displayLog.findIndex(findParentCommit(stash));
    const parentCommitCol = logMatrix[parentCommitRow].findIndex(cellContainsCommit)!;

    // If we have merge commits above, we have a line starting from the parent commit, so we must move the stash upper
    const countMergeCommitsAbove = this.countMergeCommitsAbove(parentCommitRow);

    const stashInsertionRow = parentCommitRow - countMergeCommitsAbove;

    // Insert stash into displayLog, over its parent commit, and over merge commits
    this.displayLog.splice(stashInsertionRow, 0, stash);

    // Insert empty row in matrix for the stash
    logMatrix.splice(stashInsertionRow, 0, new Array(logMatrix[0].length).fill([]));
    // And place the stash inside on parent's column
    const stashCol = this.findFreeColumnForStash(stashInsertionRow, parentCommitRow, parentCommitCol, logMatrix);

    // Draw the stash
    logMatrix[stashInsertionRow][stashCol] = [new CellContent(stash, stashCol)];

  }

  private countMergeCommitsAbove(startRow: number) {
    for (let row = startRow - 1; row > 0; row--) {
      if (isMergeRef(this.displayLog[row])) continue;
      else return startRow - row - 1;
    }
    return 0;
  }

  private findFreeColumnForStash(stashInsertionRow: number, parentCommitRow: number, parentCommitCol: number, logMatrix: LogMatrix) {
    const stashParentHasChildren = this.childrenMap[this.displayLog[parentCommitRow].sha]?.length > 0;
    if (!stashParentHasChildren)
      return parentCommitCol;

    // Find another column to place our stash. Search on the left first for free space
    for (let col = parentCommitCol - 1; col > 0; col--) {
      const commitAbove = this.findNextCommitAbove(stashInsertionRow, col, logMatrix);
      // Search the parents of the commit above our parentCommitRow. If found, get the row of the lowest one, it'll give us our free-range
      const parentOfCommitAbove = max(commitAbove?.parentSHAs.map(p => this.displayLog.findIndex(c => c.sha == p))) ?? parentCommitRow;

      // If we have free room in this column, between the stash and its parent it's ok !
      if (stashInsertionRow > parentOfCommitAbove) return col;

    }

    // TODO: If no free columns are found on the left, then seek free columns on the right
    //   Also push a new column if no free column is found ?

    // No free column were found, we put the stash in the middle of a line.
    return parentCommitCol;
  }

  // TODO: move in a service ?
  private findNextCommitAbove(start: number, col: number, logMatrix: LogMatrix): DisplayRef | undefined {
    for (let row = start - 1; row > 0; row--) {
      if (logMatrix[row][col]?.length > 0) return logMatrix[row][col][0].value as DisplayRef;
    }
    return undefined;
  }
}
