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

import type {MenuItem} from 'primeng/api';
import type {GitWorktree} from '../models/git-worktree';
import type {GitDirs} from './git-path.utils';

// Paths are compared with ===: the ones coming in (opened folder, git worktree list) go through this first
export const withoutTrailingSlash = (path: string) => path.replace(/(.)[/\\]+$/, '$1');

export const worktreeName = (path: string) => path.split(/[/\\]/).filter(Boolean).at(-1) ?? path;

/** Main worktree when `path` is a linked worktree; undefined otherwise. */
export const mainWorktreeOf = ({commonDir}: GitDirs, path: string) => {
  const [, main] = /^(.*)[/\\]\.git[/\\]?$/.exec(commonDir) ?? [];
  return main !== undefined && main !== path ? main : undefined;
};

export const otherWorktreeTooltip = (path: string) =>
  `Checked out in worktree ${worktreeName(path)}: checking it out switches to that worktree`;

/** Branches checked out in other worktrees, by name → worktree path; git won't move or delete them here. */
export const branchesCheckedOutElsewhere = (worktrees: GitWorktree[], path: string | undefined) =>
  new Map(worktrees.filter(w => w.branch && w.path !== path).map(w => [w.branch!, w.path]));

// A menu action that git refuses because its branch is checked out in the worktree at `path`
export const lockedByWorktree = (item: MenuItem, path: string): MenuItem =>
  ({...item, label: `${item.label} (checked out in ${worktreeName(path)})`, disabled: true});
