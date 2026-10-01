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
import {type DisplayRef} from '../lib/github-desktop/model/display-ref';
import {Commit} from '../lib/github-desktop/model/commit';
import {Branch, BranchType} from '../lib/github-desktop/model/branch';
import {RefType} from '../enums/ref-type.enum';
import {notUndefined, removeDuplicates} from '../utils/utils';
import {byName, createIndexCommit} from '../utils/log-utils';
import {buildStashMap, findCurrentHeadCommit, stashUntrackedChildren} from '../utils/commit-utils';
import {IntervalTree} from 'node-interval-tree';
import {Edge} from '../models/edge';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {layoutGraph} from './graph-layout';

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

  private branches = inject(CurrentRepoStore).branches;

  buildDisplayLog(logs: Commit[], stashChildren: Commit[], indexParent?: DisplayRef): LogBuildResult {
    const stashMap = buildStashMap(stashChildren);
    const untrackedStashes = stashUntrackedChildren(stashChildren);

    const commits = logs.filter(l => !untrackedStashes.includes(l.sha)).map(c => this.commitToDisplayRef(c, stashMap[c.sha]));
    // "Index" commit = working directory changes
    if (indexParent) commits.unshift(createIndexCommit(indexParent));

    const displayLog = this.saveRowIndexIntoDisplayRef(commits);

    // The work in progress (index) commit, or the checked out commit, gets the straight leftmost column
    const headSha = findCurrentHeadCommit(logs)?.sha;
    const mainTip = indexParent ? displayLog[0] : displayLog.find(c => c.sha == headSha);
    const {edges: layoutEdges, columnCount} = layoutGraph(displayLog, mainTip);

    const edges = new IntervalTree<Edge>();
    layoutEdges.forEach(edge => edges.insert(edge));

    return {displayLog, untrackedStashes, edges, graphColumnCount: columnCount};
  }

  /**
   * Read commits top to bottom and style them (lanes & connections)
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

  private saveRowIndexIntoDisplayRef(log: DisplayRef[]) {
    log.forEach((c, i) => c.row = i);
    return log;
  }
}
