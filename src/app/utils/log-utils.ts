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

import type {Branch} from '../lib/github-desktop/model/branch';
import type {DisplayRef} from '../lib/github-desktop/model/display-ref';
import {RefType} from '../enums/ref-type.enum';
import {uniq} from 'lodash-es';
import {notUndefined} from './utils';
import type {Commit} from '../lib/github-desktop/model/commit';
import type {LogObject} from '../models/log-object';

export const byName = (branchName: string) => (branch: Branch) => branch.name == branchName;

/** BFS from descendantSha toward root — returns true if ancestorSha is reachable. */
export const isAncestor = (ancestorSha: string, descendantSha: string, logs: Commit[]): boolean => {
  if (ancestorSha === descendantSha) return false;
  const parentMap = new Map(logs.map(c => [c.sha, c.parentSHAs]));
  const visited = new Set<string>();
  const queue = [descendantSha];
  while (queue.length) {
    const sha = queue.shift()!;
    if (sha === ancestorSha) return true;
    if (visited.has(sha)) continue;
    visited.add(sha);
    for (const p of parentMap.get(sha) ?? []) queue.push(p);
  }
  return false;
};

/** Number of commits reachable from `sha` but not from `exceptSha` (like `git rev-list --count exceptSha..sha`), within the loaded logs. */
export const countCommitsNotIn = (sha: string, exceptSha: string, logs: Commit[]): number => {
  const parentMap = new Map(logs.map(c => [c.sha, c.parentSHAs]));
  const reachable = (from: string) => {
    const visited = new Set<string>();
    const queue = [from];
    while (queue.length) {
      const s = queue.shift()!;
      if (visited.has(s) || !parentMap.has(s)) continue;
      visited.add(s);
      queue.push(...parentMap.get(s)!);
    }
    return visited;
  };
  const excluded = reachable(exceptSha);
  return [...reachable(sha)].filter(s => !excluded.has(s)).length;
};

export const commitCount = (n: number) => n === 1 ? '1 commit' : `${n} commits`;

export const bySha = (sha: string) => (c: DisplayRef) => c.sha === sha;

export const createIndexCommit = (parentCommit: DisplayRef) => ({
  summary: 'WIP',
  ref: parentCommit.ref,
  sha: 'index',
  parentSHAs: [parentCommit.sha] as string[],
  branchesDetails: [] as Branch[],
  refType: RefType.INDEX,
  isPointedByLocalHead: false,
  author: {},
  committer: {},
} as DisplayRef);

// The commit that replaced `commit` after a reword, amend, rebase or squash: git keeps its author and author date
const rewrittenAs = (commit: LogObject, newCommits: LogObject[]) => {
  const authorDateMs = commit.author?.date?.getTime();
  if (authorDateMs === undefined) return undefined;
  const candidates = newCommits.filter(c => c.author?.email === commit.author.email && c.author?.date?.getTime() === authorDateMs);
  return candidates.find(c => c.summary === commit.summary) ?? candidates[0];
};

// What stands for a vanished commit: its new version, else its nearest ancestor still in the log (or that one's new version)
const replacementOf = (sha: string, previousBySha: Map<string, LogObject>, shownShas: Set<string>, newCommits: LogObject[]) => {
  for (let commit = previousBySha.get(sha); commit; commit = previousBySha.get(commit.parentSHAs[0])) {
    if (shownShas.has(commit.sha)) return commit.sha;
    const rewritten = rewrittenAs(commit, newCommits);
    if (rewritten) return rewritten.sha;
  }
  return undefined;
};

/**
 * The selection once the log changed, keeping the user's place when selected commits vanish:
 * a dropped commit gives its parent, a deleted branch its start commit, a reworded or rebased commit its new version.
 * Outside the loaded log, the commit now on the same row; with nothing selected, the top row.
 */
export const followSelection = (selectedShas: string[], previousLog: LogObject[], log: LogObject[]): string[] => {
  if (!log.length) return selectedShas;
  const shownShas = new Set(log.map(c => c.sha));
  if (selectedShas.length && selectedShas.every(sha => shownShas.has(sha))) return selectedShas;

  const previousBySha = new Map(previousLog.map(c => [c.sha, c]));
  const newCommits = log.filter(c => !previousBySha.has(c.sha));
  const followedShas = uniq(selectedShas
    .map(sha => shownShas.has(sha) ? sha : replacementOf(sha, previousBySha, shownShas, newCommits))
    .filter(notUndefined));
  if (followedShas.length) return followedShas;

  const previousRow = previousLog.findIndex(c => selectedShas.includes(c.sha));
  return [log[Math.min(Math.max(previousRow, 0), log.length - 1)].sha];
};
