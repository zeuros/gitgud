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

/**
 * Parses output of diff flags -z --raw --numstat.
 *
 * Given the -z flag the new lines are separated by \0 character (left them as
 * new lines below for ease of reading)
 *
 * For modified, added, deleted, untracked:
 *    100644 100644 5716ca5 db3c77d M
 *    file_one_path
 *    :100644 100644 0835e4f 28096ea M
 *    file_two_path
 *    1    0       file_one_path
 *    1    0       file_two_path
 *
 * For copied or renamed:
 *    100644 100644 5716ca5 db3c77d M
 *    file_one_original_path
 *    file_one_new_path
 *    :100644 100644 0835e4f 28096ea M
 *    file_two_original_path
 *    file_two_new_path
 *    1    0
 *    file_one_original_path
 *    file_one_new_path
 *    1    0
 *    file_two_original_path
 *    file_two_new_path
 */

import type {ChangeSet} from './model/change-set';
import {type AppFileStatus, AppFileStatusKind, CommittedFileChange, isConflictedStatusCode} from './model/status';
import {throwEx} from '../../utils/utils';
import {isCopyOrRename, mapPorcelainStatus, mapStatus} from './log';
import {type WorkDirStatus, WorkingDirectoryFileChange} from './model/workdir';

// A raw entry (its status line and path lines) parsed into a file change, with the index of its last line
interface RawEntry {
  file: CommittedFileChange;
  lastIndex: number;
}

// Combined diff format (3+ commits): ::mode mode mode hash hash hash MM path
const parseCombinedEntry = (lines: string[], i: number, latestSha: string): RawEntry => {
  const parts = lines[i].split('\t');
  const statusPart = parts[0].split(' ').pop()!;
  const lastIndex = parts[1] ? i : i + 1;

  // Take last character of combined status (e.g., "MM" -> "M")
  const statusChar = statusPart.charAt(statusPart.length - 1);

  return {file: new CommittedFileChange(parts[1] || lines[lastIndex], {kind: mapStatus(statusChar)} as AppFileStatus, latestSha), lastIndex};
};

// Regular diff format (2 commits): :mode mode hash hash status path
const parseRegularEntry = (lines: string[], i: number, latestSha: string, baseSha?: string): RawEntry => {
  const status = lines[i].split(' ').pop()!;
  const isCopyOrRenameStatus = /^[RC]/.test(status);
  const oldPath = isCopyOrRenameStatus ? lines.at(i + 1) ?? throwEx('Missing old path') : undefined;
  const lastIndex = isCopyOrRenameStatus ? i + 2 : i + 1;
  const path = lines.at(lastIndex) ?? throwEx('Missing path');

  return {file: new CommittedFileChange(path, {kind: mapStatus(status, oldPath), oldPath} as AppFileStatus, latestSha, baseSha), lastIndex};
};

// Numstat line: added deleted path, "-" for binary files
const parseNumstat = (line: string) => {
  const match = /^(\d+|-)\t(\d+|-)\t/.exec(line);
  if (!match) return undefined;
  const lineCount = (count: string) => count === '-' ? 0 : Number.parseInt(count);
  return {added: lineCount(match[1]), deleted: lineCount(match[2])};
};

/**
 * Parses output of diff flags -z --raw --numstat.
 * Handles single commits, 2-commit ranges, and 3+ commit combined diffs.
 *
 * @param rawFileChanges Raw git output
 * @param shas Array of commit SHAs (for commitish references)
 * @returns ChangeSet with parsed files
 */
export const parseRawLogWithNumstat = (rawFileChanges: string, shas: string[]): ChangeSet => {
  const files: CommittedFileChange[] = [];
  let linesAdded = 0;
  let linesDeleted = 0;
  let numStatCount = 0;
  const lines = rawFileChanges.split('\0');
  const latestSha = shas[shas.length - 1];
  // 2-commit range (`git diff older newer`): files must be diffed against the older commit, not the newer one's parent
  const baseSha = shas.length === 2 ? shas[0] : undefined;

  for (let i = 0 ; i < lines.length - 1 ; i++) {
    const line = lines[i];

    if (line.startsWith(':')) {
      const {file, lastIndex} = line.startsWith('::') ? parseCombinedEntry(lines, i, latestSha) : parseRegularEntry(lines, i, latestSha, baseSha);
      files.push(file);
      i = lastIndex;
      continue;
    }

    const numstat = parseNumstat(line);
    if (!numstat) continue;
    linesAdded += numstat.added;
    linesDeleted += numstat.deleted;
    // A copy or rename's numstat line is followed by its two paths
    if (files[numStatCount] && isCopyOrRename(files[numStatCount].status)) i += 2;
    numStatCount++;
  }

  return {
    kind: 'working-directory',
    files,
    linesAdded,
    linesDeleted,
  };
};

/**
 * Parses the output of `git status --porcelain -z` into staged and unstaged changes.
 * @param workingDirectoryChanges The raw output from Git.
 * @returns An object containing staged and unstaged changes.
 */

export const parseWorkingDirChanges = (workingDirectoryChanges: string): WorkDirStatus => {
  const staged: WorkingDirectoryFileChange[] = [];
  const unstaged: WorkingDirectoryFileChange[] = [];
  const conflicted: WorkingDirectoryFileChange[] = [];

  workingDirectoryChanges
    .split('\0')
    .filter(Boolean) // Remove empty entries
    .forEach((entry) => {
      // Extract the two-character status (e.g., "M ", "MM", "??", "A ")
      const rawStatus = entry.substring(0, 2);
      const stagedStatus = rawStatus.charAt(0);
      const unstagedStatus = rawStatus.charAt(1);
      const path = entry.substring(2).trim();

      if (isConflictedStatusCode(rawStatus)) {
        conflicted.push(new WorkingDirectoryFileChange(path, {kind: AppFileStatusKind.Conflicted} as AppFileStatus));
        return;
      }

      const appStatus = {kind: mapPorcelainStatus(rawStatus)} as AppFileStatus;

      // Push to staged/unstaged arrays if the status is non-empty
      if (['A', 'M', 'D', 'R', 'C'].includes(stagedStatus))
        staged.push(new WorkingDirectoryFileChange(path, appStatus, true));
      if (['M', '?'].includes(unstagedStatus))
        unstaged.push(new WorkingDirectoryFileChange(path, appStatus));
    });

  return {unstaged, staged, conflicted};
};