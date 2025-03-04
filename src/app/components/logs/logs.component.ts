import {Component, Input} from '@angular/core';
import {GitRepository} from '../../models/git-repository';
import {TableModule} from 'primeng/table';
import {DatePipe, JsonPipe, NgClass, NgForOf, NgIf} from '@angular/common';
import {Commit} from '../../models/commit';
import {RefType} from '../../enums/ref-type.enum';
import {removeDuplicates, removeUndefined, reversedForEach, throwEx} from '../../utils/utils';
import {Stash} from '../../models/stash';
import {Branch, BranchType} from "../../models/branch";
import {byName, bySha, cellContainsCommit, isDisplayRef} from "../../utils/log-utils";
import {DisplayRef} from "../../models/display-ref";
import {max} from "lodash";
import {buildChildrenMap, buildCommitMap, ChildrenMap, CommitMap, hasNoBranching} from "../../utils/commit-utils";
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
  protected refs: string[] = [];
  protected branches: ReadonlyArray<Branch> = []; // Local and distant branches
  protected readonly removeDuplicates = removeDuplicates;
  protected logMatrix: LogMatrix = [[]];
  protected logMatrixSymbolClasses: { [s in LogMatrixSymbol]: string } = {
    [LogMatrixSymbol.HORIZONTAL]: 'horizontal',
    [LogMatrixSymbol.VERTICAL]: 'vertical full',
    [LogMatrixSymbol.VERTICAL_TOP]: 'vertical top',
    [LogMatrixSymbol.VERTICAL_BOTTTOM]: 'vertical bottom',
    [LogMatrixSymbol.TOP_RIGHT]: 'turn top-right',
    [LogMatrixSymbol.TOP_LEFT]: 'turn top-left',
    [LogMatrixSymbol.BOTTOM_RIGHT]: 'turn bottom-right',
    [LogMatrixSymbol.BOTTOM_LEFT]: 'turn bottom-left'
  };
  protected isDisplayRef = isDisplayRef;

  @Input() set gitRepository(gitRepository: GitRepository) {

    if (!gitRepository.logs.length) return;

    // Sort branches by last commit date put on it => first branch is the one pointing to the last commit in date
    this.branches = gitRepository.branches;

    const commitMap = buildCommitMap(gitRepository.logs);

    const childrenMap = buildChildrenMap(gitRepository.logs);

    this.displayLog = this.prepareDisplayLog(gitRepository.logs, gitRepository.stashes, commitMap, childrenMap);

    // TODO: move columns of successive commits onto another column in order to save space if possible

    this.logMatrix = this.drawCommitsConnections(this.clearEmptyColumns(this.buildLogMatrix(this.displayLog)), this.displayLog, childrenMap);

  }

  protected notZero = (i: number) => i == 0 ? 1 : i;

  protected branchName = (b: Branch) => b.name.replace('origin/', '');

  protected isPointedByHead = (d: DisplayRef) => d.branchDetails?.isPointedByLocalHead;

  protected isLogMatrixSymbol = (toDraw: CellContent) => !isDisplayRef(toDraw)

  protected $displayRef = (displayRef: any): DisplayRef => displayRef;

  // TODO: separate commit indent and put it into matrix
  private computeCommitIndent = (displayRef: DisplayRef, commitMap: { [sha: string]: Commit }, childrenMap: { [sha: string]: Commit[] }): DisplayRef => {

    let indent = this.computeCommitIndentation(displayRef);

    // If the commit has no parentSha => It is a tree root commit ! => It means that the next commits belong to another tree.
    // In order to indent commits for this new tree, we clear the saved commits refs and restart commits indentation
    const isRootCommit = displayRef.parentSHAs.length == 0;
    if (isRootCommit) this.refs = [];

    // const hasAParentFromSameBranch = displayRef.parentSHAs.map(parentSha => commitMap[parentSha]).some(parent => parent.ref == displayRef.ref);
    // const parentHasOnlyOneChild = displayRef.parentSHAs.map(parentSha => commitMap[parentSha]).some(parent => parent.ref == displayRef.ref);
    const hasOneChild = childrenMap[displayRef.sha]?.length == 1;


    // TODO: move this optimization into dedicated function
    // If this commit has not branching above (all children aligned), align it with its children.
    if (hasOneChild && hasNoBranching(displayRef, childrenMap))
      indent = this.computeCommitIndentation(childrenMap[displayRef.sha][0]);

    return {
      ...displayRef,
      style: {
        isRootCommit,
        isMergeCommit: displayRef.parentSHAs.length > 1, // A merge child is a child that ends a branch by merging it into another one. A merge commit has two parents commit
        // A branch child is a child that continues a branch or creates a new one.
        // isBranchChildren: hasAParentFromSameBranch || parentHasOnlyOneChild, // A branch children has a parent from same branch OR his parent is from different branch but with one child
        indent, // e.g. If commit belongs to most recently committed branch, indent is 0 etc ...
      }
    };
  }

  private computeCommitIndentation = (displayRef: DisplayRef | Commit) => {
    // get raw ref related to our commit (the branch it has been committed with) and match corresponding local branch
    // Group commits by their local branch (one column = one local branch) ...
    const refLocalBranch = this.findLocalRef(displayRef.ref);
    const refLocalBranchIndex = this.refs.indexOf(refLocalBranch);

    // We merge the local & remote branches to put them on the same column (meaning commits of the same local branch have the same indentation)
    return refLocalBranchIndex >= 0 ? refLocalBranchIndex : (this.refs.push(refLocalBranch) - 1);
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
      pointedByHead: true,
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

  private prepareDisplayLog = (logs: ReadonlyArray<Commit>, stashes: ReadonlyArray<Commit>, commitMap: CommitMap, childrenMap: ChildrenMap) => {

    const displayCommits = logs.map(this.commitToDisplayRef).map(r => this.computeCommitIndent(r, commitMap, childrenMap));

    const displayStashes = stashes.map(s => this.stashToDisplayRef(s, displayCommits)) // Append stashes to log, removes ref since stashes never belongs to branches.

    return this.insertStashesIntoLog(displayCommits, displayStashes);

  };

  private stashToDisplayRef = (s: Stash, displayCommits: DisplayRef[]): DisplayRef => {

    const parentCommit = displayCommits.find(c => s.parentSHAs.includes(c.sha)) ?? throwEx(`Couldn't find stash (${s.summary}) parent(s) (${s.parentSHAs})`)

    return {
      ...s,
      refType: RefType.STASH,
      pointedByHead: false,
      ref: '',
      branchDetails: {
        branches: [],
        isPointedByLocalHead: false,
        local: false,
        remote: false
      },
      style: {
        isRootCommit: false,
        isMergeCommit: false,
        indent: parentCommit.style!.indent,// same as his parent commit
      }
    }
  };

  /**
   * @param commitBranches Branch objects pointing to this commit
   */
  private findCommitBranches = (commitBranches: string): Branch[] =>
    commitBranches
      .split(', ')
      .map(this.findBranchByRef)
      .filter(removeUndefined)
      .filter(removeDuplicates);

  private insertStashesIntoLog = (displayCommits: DisplayRef[], stashes: DisplayRef[]) => {
    const stashByParentSha: { [sha: string]: DisplayRef } = {}; // { [sha]: stash0, [sha1]: stash0, [sha3]: stash1 ...}

    stashes.forEach((stash) =>
      stash.parentSHAs.forEach(stashSha =>
        stashByParentSha[stashSha] = stash
      )
    );

    let i = displayCommits.length;
    while (i--) {
      if (stashByParentSha[displayCommits[i].sha]) // Found stash parent
        displayCommits.splice(i, 0, stashByParentSha[displayCommits[i].sha]);
    }

    return displayCommits;
  };

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
  private buildLogMatrix = (displayLog: DisplayRef[]) => {
    const columnCount = max(displayLog.map(c => c.style!.indent))! + 1;

    return displayLog.map(commit => {
      // Create new row
      const row: Row = new Array(columnCount).fill([]);

      const commitColumn = commit.style!.indent;

      // Draw current commit
      row[commitColumn] = [commit];

      return row;
    });
  };

  private clearEmptyColumns = (buildLogMatrix: LogMatrix) => {
    // Find columns that only contain empty arrays
    const emptyColumnIndexes = buildLogMatrix[0].map((_, colIndex) => {
      return buildLogMatrix.every(row => row[colIndex].length === 0);
    });

    // If no empty columns found, return original matrix
    if (!emptyColumnIndexes.includes(true)) {
      return buildLogMatrix;
    }

    // Remove empty columns from each row
    return buildLogMatrix.map(row => {
      return row.filter((_, colIndex) => !emptyColumnIndexes[colIndex]);
    });
  };

  // Reads commits bottom to top and draw their children branches and merges
  private drawCommitsConnections = (logMatrix: LogMatrix, displayLog: DisplayRef[], childrenMap: ChildrenMap) => {

    // For each commit starting from root commit
    reversedForEach(displayLog, (commit, indexFromBottom) => { // Starts with the bottom commit, bottom index

      const commitCoordinates = new Coordinates(indexFromBottom, logMatrix[indexFromBottom].findIndex(cellContainsCommit));

      // Draw a connection with its children
      childrenMap[commit.sha]?.forEach(child => {

        const childRow = displayLog.findIndex(bySha(child.sha));
        const childCoordinates = new Coordinates(childRow, logMatrix[childRow].findIndex(cellContainsCommit));

        // Draw connection between parent and children
        this.drawTwoCommitsConnection(commitCoordinates, childCoordinates, logMatrix);
      })
    });

    return logMatrix;
  };


  private drawTwoCommitsConnection = (parent: Coordinates, child: Coordinates, logMatrix: LogMatrix) => {

    if (parent.col == child.col) { // Successive commits: Just connect them and the gaps between them
      logMatrix[parent.row][parent.col] = [...logMatrix[parent.row][parent.col], LogMatrixSymbol.VERTICAL_TOP];
      logMatrix[child.row][child.col] = [...logMatrix[child.row][child.col], LogMatrixSymbol.VERTICAL_BOTTTOM];
    }

    for (let rowIndex = parent.row - 1; rowIndex > child.row; rowIndex--) {
      logMatrix[rowIndex][child.col] = [...logMatrix[rowIndex][child.col], LogMatrixSymbol.VERTICAL];
    }

  };

}
