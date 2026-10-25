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

import {type GitDirs, gitPath} from './git-path.utils';

/** A git command stopped on a conflict, waiting for `--continue`, `--skip` or `--abort` */
export type GitOperation = 'rebase' | 'cherry-pick' | 'revert' | 'merge';

export const OPERATION_LABELS: Record<GitOperation, string> = {rebase: 'Rebase', 'cherry-pick': 'Cherry-pick', revert: 'Revert', merge: 'Merge'};

// In priority order: a rebase replaying a merge also leaves MERGE_HEAD. `rebase-apply/rebasing` tells a rebase from a `git am`
const STATE_FILES: [GitOperation, string][] = [
  ['rebase', 'rebase-merge'],
  ['rebase', 'rebase-apply/rebasing'],
  ['cherry-pick', 'CHERRY_PICK_HEAD'],
  ['revert', 'REVERT_HEAD'],
  ['merge', 'MERGE_HEAD'],
];

export const detectOperationInProgress = async (dirs: GitDirs, exists: (path: string) => Promise<boolean>): Promise<GitOperation | undefined> => {
  const found = await Promise.all(STATE_FILES.map(([, name]) => exists(gitPath(dirs, name))));
  return STATE_FILES.find((_, i) => found[i])?.[0];
};

/** git has no `merge --skip` */
export const canSkip = (operation: GitOperation) => operation !== 'merge';
