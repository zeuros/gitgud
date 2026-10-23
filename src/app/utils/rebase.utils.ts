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

import {short} from './commit-utils';
import type {Commit} from '../lib/github-desktop/model/commit';
import {amendFromFile} from './git-path.utils';

const messageFile = (gitDir: string) => `${gitDir}/COMMIT_EDIT_MSG`;

/** Writes the message the rebase lines of rewordCommitAction / squashActions amend with: to do before the rebase starts */
export const writeCommitMessage = (gitDir: string, message: string) => window.tauri.fs.writeFile(messageFile(gitDir), message);

// Rework git rebase actions to give a specified commit the message written by writeCommitMessage
export const rewordCommitAction = (gitDir: string, selectedCommitSha: string) => {
    const amend = amendFromFile(messageFile(gitDir));

    return (actions: string[]) =>
      actions.flatMap(action =>
        action.includes(short(selectedCommitSha))
          ? [action, amend]
          : [action],
      );
  };

/**
 * The commits of `shas` newest first, when they form one unbroken line of history that a rebase can squash:
 * each one's parent is the next one, none is a merge, and the oldest has a parent to rebase from. Otherwise undefined.
 */
export const squashableChain = (shas: string[], logs: Commit[]): Commit[] | undefined => {
  if (shas.length < 2) return undefined;
  const commits = new Map(logs.filter(c => shas.includes(c.sha)).map(c => [c.sha, c]));
  if (commits.size !== shas.length || [...commits.values()].some(c => c.parentSHAs.length !== 1)) return undefined;

  // The newest is the one that is no other selected commit's parent
  const parents = new Set([...commits.values()].map(c => c.parentSHAs[0]));
  const newest = [...commits.values()].filter(c => !parents.has(c.sha));
  if (newest.length !== 1) return undefined;

  const chain = [newest[0]];
  while (chain.length < commits.size) {
    const parent = commits.get(chain.at(-1)!.parentSHAs[0]);
    if (!parent) return undefined;
    chain.push(parent);
  }
  return chain;
};

// Whether a rebase todo line picks `sha` (todo lines hold abbreviated shas)
const actsOn = (action: string, sha: string) => {
  const actionSha = action.split(' ')[1];
  return !!actionSha && sha.startsWith(actionSha);
};

// Rework git rebase actions to meld `chain` (newest first) into its oldest commit, then give it the message written by writeCommitMessage
export const squashActions = (gitDir: string, chain: string[]) => {
  const amend = amendFromFile(messageFile(gitDir));
  const melded = chain.slice(0, -1);

  return (actions: string[]) =>
    actions.flatMap(action => {
      if (!melded.some(sha => actsOn(action, sha))) return [action];
      const fixup = action.replace(/^pick /, 'fixup ');
      return actsOn(action, chain[0]) ? [fixup, amend] : [fixup];
    });
};
