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

import {orderBy} from 'lodash-es';
import type {TreeNode} from 'primeng/api';
import {type Branch, BranchType} from '../lib/github-desktop/model/branch';
import {toPathTree} from './tree-utils';

export const local = (branch: Branch) => branch.type == BranchType.Local;
export const remote = (branch: Branch) => branch.type == BranchType.Remote;

/** @param isCurrent the branch checked out, or for remote branches the upstream of the one checked out */
export const toBranchTree = (branches: Branch[], isCurrent: (branch: Branch) => boolean) =>
  toPathTree(branches, branch => branch.name, branch => ({
    icon: isCurrent(branch) ? 'fa fa-check checkout-icon' : 'fa fa-code-fork',
    styleClass: isCurrent(branch) ? 'worktree-current' : undefined,
  }));

/** One folder per remote, an empty one for a remote without fetched branches */
export const toRemoteTree = (remoteBranches: Branch[], remoteNames: string[], isCurrent: (branch: Branch) => boolean): TreeNode<Branch>[] => {
  const folders = toBranchTree(remoteBranches, isCurrent);
  const emptyFolders = remoteNames
    .filter(name => !folders.some(folder => folder.key === name))
    .map(name => ({key: name, label: name, icon: 'pi pi-folder', children: []}));
  return [...folders, ...emptyFolders].map(folder => ({...folder, type: 'remote-root'}));
};

export interface RemoteAndBranch {
  remote: string;
  branch: string;
}

export const parseRemote = (name: string): RemoteAndBranch => {
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

// For any name (local or remote) => filter out the origin part to keep branch name only
export const normalizedBranchName = (b: {name: string} | null) => b?.name.replace(/^origin\//, '');

/** A local branch and the remote branch shown with it, in one chip */
export type LocalAndRemoteBranch = {localBranch?: Branch; remoteBranch?: Branch};

// Used to sort the pairs by putting the head-pointed one first
export const isHeadPointed = ({localBranch, remoteBranch}: LocalAndRemoteBranch) =>
  localBranch?.isHeadPointed ?? remoteBranch?.isHeadPointed ?? false;

// The remote branch shown with a local branch: its upstream only, or without one a same-named branch on any remote, origin first
const findRemoteBranch = (localBranch: Branch, remoteBranches: Branch[]) => {
  if (localBranch.upstream) return remoteBranches.find(remoteBranch => remoteBranch.name === localBranch.upstream);

  return remoteBranches.find(remoteBranch => remoteBranch.name === `origin/${localBranch.name}`)
    ?? remoteBranches.find(remoteBranch => parseRemote(remoteBranch.name).branch === localBranch.name);
};

/** Pairs each local branch with its remote branch among branches at one tip; unpaired remote branches stand alone. */
export const toLocalAndRemotePairs = (branches: Branch[]): LocalAndRemoteBranch[] => {
  const remoteBranches = branches.filter(remote);
  const pairedRemoteBranches = new Set<Branch>();
  const unpairedRemoteBranches = () => remoteBranches.filter(remoteBranch => !pairedRemoteBranches.has(remoteBranch));

  const pairs = branches.filter(local).map((localBranch): LocalAndRemoteBranch => {
    const remoteBranch = findRemoteBranch(localBranch, unpairedRemoteBranches());
    if (remoteBranch) pairedRemoteBranches.add(remoteBranch);
    return {localBranch, remoteBranch};
  });

  return orderBy(
    [...pairs, ...unpairedRemoteBranches().map((remoteBranch): LocalAndRemoteBranch => ({remoteBranch}))],
    isHeadPointed,
    'desc',
  );
};
