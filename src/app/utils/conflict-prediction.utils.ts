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

import {type MenuItem} from 'primeng/api';

// Parses `git merge-tree --write-tree --name-only --no-messages`: the merged tree's id, then the conflicted paths.
// Exits with 1 when the merge has conflicts, 0 when it is clean (anything else: git couldn't tell)
export const parseMergeTreeConflicts = (status: number | null, stdout: string) =>
  status == 1 ? [...new Set(stdout.split('\n').slice(1).filter(line => line.length))] : [];

const MAX_LISTED_FILES = 12;

/** Flags a merge / rebase menu item whose branches are known to conflict */
export const withConflictWarning = (item: MenuItem, conflicts: string[] | undefined): MenuItem => {
  if (!conflicts?.length) return item;
  const listed = conflicts.slice(0, MAX_LISTED_FILES);
  const more = conflicts.length - listed.length;
  return {
    ...item,
    label: `${item.label} (${conflicts.length} conflicting file${conflicts.length > 1 ? 's' : ''})`,
    styleClass: 'conflict-menuitem',
    tooltipOptions: {tooltipLabel: [...listed, ...(more ? [`… and ${more} more`] : [])].join('\n'), tooltipPosition: 'right'},
  };
};
