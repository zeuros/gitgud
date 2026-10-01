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

import {Commit} from '../lib/github-desktop/model/commit';
import {type DisplayRef} from '../lib/github-desktop/model/display-ref';
import {RefType} from '../enums/ref-type.enum';
import {CommitIdentity} from '../lib/github-desktop/model/commit-identity';
import Identicon from 'identicon.js';
import {Branch} from '../lib/github-desktop/model/branch';
import {notUndefined} from './utils';


export type ChildrenMap = { [parentSha: string]: DisplayRef[] };
export type StashMap = { [stashMergeParent: string]: Commit };


export const isCommit = (displayRef: DisplayRef) => displayRef.refType == RefType.COMMIT;
export const isIndex = (displayRef: DisplayRef) => displayRef.refType == RefType.INDEX;
export const isStash = (displayRef: DisplayRef) => displayRef.refType == RefType.STASH;
export const isMergeCommit = (displayRef: DisplayRef) => isCommit(displayRef) && displayRef.parentSHAs.length > 1;

export const initials = (author: CommitIdentity) => author.name.split(' ').slice(0, 2).map(e => e[0]).join('').toUpperCase();
export const hasName = (author: CommitIdentity) => author.name.length > 0;
export const commitColor = (lane: number) => `hue-rotate(${lane * 360 / 7}deg)`;

export const short = (sha: string) => sha.substring(0, 6);

// TODO move somewhere
export const edgeType = (childCommit: DisplayRef) => {
  if (childCommit.refType == RefType.INDEX) return RefType.INDEX;
  else if (isMergeCommit(childCommit)) return RefType.MERGE_COMMIT;
  else return RefType.COMMIT;
};

/**
 *                                                                                       (c)
 * True if the commit children have not splitted edges like (c) - (c) and not like (c) <
 *                                                                                       (c)
 */
export const hasNoBranching = (displayRef: DisplayRef | Commit, childMap: ChildrenMap): boolean => {
  const childrenCommits = childMap[displayRef.sha] ?? [];

  if (childrenCommits.length > 1) return false; // Found a branching (commit with 2+ children)

  if (childrenCommits.length == 0) return true; // We followed the commits till last one without finding branching

  return hasNoBranching(childrenCommits[0], childMap);
};

export const buildStashMap = (stashes: Commit[]) => {
  const stashMap: StashMap = {};

  for (const stash of stashes) {
    if (stash.parentSHAs[1]) stashMap[stash.parentSHAs[1]] = stash;
  }

  return stashMap;
};

export const stashUntrackedChildren = (stashes: Commit[]) => stashes.map(s => s.parentSHAs?.[2]).filter(notUndefined);

export const identIcon = async (email: string) => {
  const hash = await window.tauri.crypto.md5(email);
  return new Identicon(hash, {size: 48, format: 'png', background: [0, 0, 0, 0]});
};

export const headCommit = (branches: Branch[], logs: Commit[], offset = 0) => {
  const headBranch = branches.find(b => b.isHeadPointed);
  let commit = logs.find(c => c.sha === headBranch?.tip.sha);
  for (let i = 0 ; i < Math.abs(offset) ; i++) {
    commit = logs.find(c => c.sha === commit?.parentSHAs?.[0]);
  }
  return commit;
};

/**
 * Returns commit pointed at by HEAD (detached or attached).
 * In detached mode, the checked-out commit has a bare "HEAD" entry.
 * In attached mode, the checked-out commit has a "HEAD -> <branch>" entry.
 */
export const findCurrentHeadCommit = (logs: Commit[]) => {
  const heads =  logs.filter(c => c.branches?.length && c.branches.includes('HEAD'));

  return heads.find(c => c.branches.split(', ').some(b => b === 'HEAD'))
    ?? heads.find(c => c.branches.split(', ').some(b => b.startsWith('HEAD ->')));
};