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

import {groupBy, orderBy, values} from 'lodash-es';
import {type Branch, BranchType} from '../lib/github-desktop/model/branch';
import type {TreeNode} from 'primeng/api';
import {toPathTree} from './tree-utils';

export const local = (branch: Branch) => branch.type == BranchType.Local;
export const remote = (branch: Branch) => branch.type == BranchType.Remote;

export const toBranchTree = (branches: Branch[]): TreeNode<Branch>[] =>
  toPathTree(branches, branch => branch.name, branch => ({
    icon: branch.isHeadPointed ? 'fa fa-check checkout-icon' : 'fa fa-code-fork',
    styleClass: branch.isHeadPointed ? 'worktree-current' : undefined,
  }));

export const parseRemote = (name: string): {remote: string; branch: string} => {
  const slash = name.indexOf('/');
  return {remote: name.substring(0, slash), branch: name.substring(slash + 1)};
};

/** A local branch's upstream, else its name on origin */
export const upstreamOf = (localBranch: Branch) => localBranch.upstream ?? `origin/${localBranch.name}`;

/** A remote branch itself, or a local branch's upstream */
export const remoteRefOf = (branch: Branch) => remote(branch) ? branch.name : upstreamOf(branch);

/** The local branch tracking a remote branch, else the one with its name */
export const localBranchOf = (remoteBranch: Branch, branches: Branch[]) => {
  const localBranches = branches.filter(local);
  return localBranches.find(branch => branch.upstream === remoteBranch.name)
    ?? localBranches.find(branch => branch.name === parseRemote(remoteBranch.name).branch);
};

// For any name (local / distant) => filter out the origin part to keep branch name only
export const normalizedBranchName = (b: {name: string} | null) => b?.name.replace(/^origin\//, '');

/** A pair of branches sharing the same normalized name. local is index 0, distant is index 1. */
export type LocalAndDistant = [local: Branch | null, distant: Branch | null];

// Used to sort LocalAndDistant pairs by putting the head-pointed group first
export const isHeadPointed = ([local, distant]: LocalAndDistant) =>
  local?.isHeadPointed ?? distant?.isHeadPointed ?? false;

export const toLocalAndDistantPairs = (branches: Branch[]): LocalAndDistant[] =>
  orderBy(
    values(groupBy(branches, normalizedBranchName))
      .map(group => [group.find(local) ?? null, group.find(remote) ?? null] as LocalAndDistant),
    isHeadPointed,
    'desc',
  );