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

import {inject, Injectable} from '@angular/core';
import {DisplayRef} from '../lib/github-desktop/model/display-ref';
import {Commit} from '../lib/github-desktop/model/commit';
import {Branch, BranchType} from '../lib/github-desktop/model/branch';
import {RefType} from '../enums/ref-type.enum';
import {notUndefined, removeDuplicates} from '../utils/utils';
import {byName, createIndexCommit} from '../utils/log-utils';
import {
  buildChildrenMap,
  buildShaMap,
  buildStashMap,
  ChildrenMap,
  edgeType,
  isCommit,
  isIndex,
  isMergeCommit,
  isRootCommit,
  isStash,
  ShaMap,
  stashUntrackedChildren,
} from '../utils/commit-utils';
import {IntervalTree} from 'node-interval-tree';
import {Edge} from '../models/edge';
import {CurrentRepoStore} from '../stores/current-repo.store';

type Column = ['taken' | 'free', rowCount: number];

interface ColumnsState {
  columns: Column[];
  maxIndent: number;
}

export interface LogBuildResult {
  displayLog: DisplayRef[];
  edges: IntervalTree<Edge>;
  untrackedStashes: string[];
  graphColumnCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class LogBuilderService {

  private readonly branches = inject(CurrentRepoStore).branches;

  buildDisplayLog(logs: Commit[], stashChildren: Commit[], indexParent?: DisplayRef): LogBuildResult {
    const stashMap = buildStashMap(stashChildren);
    const untrackedStashes = stashUntrackedChildren(stashChildren);

    const commits = logs.filter(l => !untrackedStashes.includes(l.sha)).map(c => this.commitToDisplayRef(c, stashMap[c.sha]));
    // "Index" commit = working directory changes
    if (indexParent) commits.unshift(createIndexCommit(indexParent));

    const shaMap = buildShaMap(commits);
    const childrenMap = buildChildrenMap(commits);

    const displayLog = this.saveRowIndexIntoDisplayRef(commits);

    const columnState: ColumnsState = {columns: [], maxIndent: 0};
    this.computeCommitsIndents(displayLog, shaMap, childrenMap, columnState);

    const edges = this.updateEdgeIntervals(displayLog, childrenMap);

    return {displayLog, untrackedStashes, edges, graphColumnCount: columnState.maxIndent + 1};
  }

  /**
   * Read commits top to bottom and style them (indentation & connections)
   * TODO: Cleanup this branch mess and use basic types provided by github-desktop, also clean the uniqBy
   */
  private commitToDisplayRef(commit: Commit, stashChild?: Commit): DisplayRef {
    const commitBranches = this.findCommitBranches(commit.branches) ?? [];

    return {
      ...commit,
      summary: stashChild?.summary ?? commit.summary,
      refType: stashChild ? RefType.STASH : RefType.COMMIT,
      isPointedByLocalHead: !!commitBranches.find(b => !b.name.includes('origin/') && b.isHeadPointed),
      branchesDetails: commitBranches,
    };
  }

  /**
   * @param commitBranches Branch objects pointing to this commit
   */
  private findCommitBranches(commitBranches: string): Branch[] {
    return commitBranches
      .split(', ')
      .map(this.findBranchByRef)
      .filter(notUndefined)
      .filter(removeDuplicates);
  }

  private findBranchByRef = (branchRef: string) => {
    if (branchRef.includes('origin/HEAD')) // Commit is pointed by remote head (usually origin/main)
      return this.branches().find(b => b.type == BranchType.Remote && b.isHeadPointed);
    else if (branchRef.includes('HEAD -> ')) // This commit is pointed by local HEAD, git tells which branch is pointed at. e.g: (HEAD -> branchPointedAt)
      return this.branches().find(byName(branchRef.replace('HEAD -> ', '')));

    return this.branches().find(byName(branchRef));
  };

  // Indent will be reused for future commits
  private computeCommitsIndents(displayLog: DisplayRef[], shaMap: ShaMap, childrenMap: ChildrenMap, state: ColumnsState) {
    displayLog.forEach(commit => {
      commit.indent = this.computeCommitIndent(commit, shaMap, childrenMap, state);
      // Track max indent during computation
      if (commit.indent > state.maxIndent) state.maxIndent = commit.indent;
      // Increment all column counts
      for (let i = 0 ; i < state.columns.length ; i++) {
        state.columns[i][1]++;
      }
    });
  }

  // Every commit from top (index=0) to bottom will be chosen a column (indent)
  private computeCommitIndent(commit: DisplayRef, shaMap: ShaMap, childrenMap: ChildrenMap, colState: ColumnsState): number {
    if (commit.refType == RefType.INDEX) {
      const indent = this.pushNewColumn(colState);
      // Align index commit on its parent
      const parent = shaMap[commit.parentSHAs[0]];
      if (parent) parent.indent = indent;
      return indent;
    }

    const children = (childrenMap[commit.sha] ?? []).filter(c => isCommit(c) || isStash(c) || isIndex(c));
    // If commit has a child having current commit as first parent, we align with this commit
    const childrenOfSameBranch = children.filter(child => child.parentSHAs[0] == commit.sha);
    const leftChildOfSameBranch = childrenOfSameBranch.find(isMergeCommit) ?? childrenOfSameBranch[0]; // The children we align with
    const hasMergeChild = children.some(isMergeCommit);
    let distanceToNextMergeCommit = 0;

    if (hasMergeChild) {
      const farthestMergeChild = children
        .filter(isMergeCommit)
        .sort((c1, c2) => c1.row! > c2.row! ? 1 : -1)[0];

      distanceToNextMergeCommit = commit.row! - farthestMergeChild.row!;
    }

    // If the commit has no parentSha => It is a tree root commit ! => It means that the following commits belong to another tree.
    // In order to indent commits for this new tree, we clear the saved commits refs and restart commits indentation from column 0
    if (isRootCommit(commit)) {

      // Free tree main column
      // this.setColumnFree(children[0].indent!, colState);

      // The column of a root commit will remain taken since it doesn't have a parent to free the column
      return children[0].indent!;
    }

    if (children.length > 1 && leftChildOfSameBranch) {
      // Free all the children we don't align with
      this.freeChildrenColumns(children.filter(c => !isMergeCommit(c)), commit.indent ?? leftChildOfSameBranch.indent!, colState);
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
        .forEach(otherParent => otherParent.indent = this.findFreeColumnOrPushNewColumn(-1, colState));

      // Either the column of the commit has been determined by its parent ?? else, comes from his 'favorite' children (referencing this commit in parentSha[0]) ?? Else pushes a new column
      const indent = commit.indent ?? leftChildOfSameBranch?.indent ?? this.findFreeColumnOrPushNewColumn(distanceToNextMergeCommit, colState);

      firstParent.indent = indent;

      return indent;
    }

    // This commit have been positioned in a column by its merge children. We have to mark this column taken because the child didn't do it
    if (commit.indent != undefined) {
      colState.columns[commit.indent] = ['taken', 0];
      return commit.indent;
    }

    // We have a parent to align to, column already taken
    if (leftChildOfSameBranch?.indent != undefined) return leftChildOfSameBranch.indent;

    // We don't have child to align to => push a new column
    return this.findFreeColumnOrPushNewColumn(distanceToNextMergeCommit, colState);
  }

  private freeChildrenColumns(childrenOfSameBranch: DisplayRef[], excludeThisColumn: number, state: ColumnsState) {
    childrenOfSameBranch
      .filter(child => child.indent! != excludeThisColumn)
      .forEach(child => this.setColumnFree(child.indent!, state));
  }

  // keep track of the states of the columns when drawing commits from top to bottom
  private findFreeColumnOrPushNewColumn(neededFreeSpaceAbove = 0, colState: ColumnsState): number {
    const freeColumn = colState.columns.findIndex(this.isColumnFree(neededFreeSpaceAbove + 1));

    if (freeColumn != -1) {
      colState.columns[freeColumn] = ['taken', 0];
      return freeColumn;
    } else {
      return this.pushNewColumn(colState);
    }
  }

  private isColumnFree = (neededFreeSpaceAbove: number) => ([status, spaceCount]: Column) =>
    status == 'free' && spaceCount >= neededFreeSpaceAbove;


  /**
   * Creates an interval tree with all the vertical connections between commits
   */
  private updateEdgeIntervals(commitsLog: DisplayRef[], childrenMap: ChildrenMap) {
    const edges = new IntervalTree<Edge>();

    commitsLog.forEach(commit => {
      const [parentRow, parentCol] = [commit.row!, commit.indent!];

      childrenMap[commit.sha]?.forEach(child => {
        const [childRow, childCol] = [child.row!, child.indent!];
        edges.insert(new Edge(childRow, childCol, parentRow, parentCol, edgeType(child)));
      });
    });

    return edges;
  }

  private saveRowIndexIntoDisplayRef(log: DisplayRef[]) {
    log.forEach((c, i) => c.row = i);
    return log;
  }

  private setColumnFree(column: number, state: ColumnsState) {
    state.columns[column] = ['free', 0];
  }

  private pushNewColumn(state: ColumnsState) {
    return state.columns.push(['taken', 0]) - 1;
  }
}
