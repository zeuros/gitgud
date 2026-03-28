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

import {ChangeSet} from './model/change-set';
import {AppFileStatus, CommittedFileChange} from './model/status';
import {forceUnwrap} from './throw-ex';
import {isCopyOrRename, mapPorcelainStatus, mapStatus} from './log';
import {WorkDirStatus, WorkingDirectoryFileChange} from './model/workdir';

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

  for (let i = 0 ; i < lines.length - 1 ; i++) {
    const line = lines[i];

    // Combined diff format (3+ commits): ::mode mode mode hash hash hash MM path
    if (line.startsWith('::')) {
      const parts = line.split('\t');
      const statusPart = parts[0].split(' ').pop()!;
      const path = parts[1] || lines[++i];

      // Take last character of combined status (e.g., "MM" -> "M")
      const statusChar = statusPart.charAt(statusPart.length - 1);

      files.push(new CommittedFileChange(
        path,
        {kind: mapStatus(statusChar)} as AppFileStatus,
        latestSha,
      ));
    }
    // Regular diff format (2 commits): :mode mode hash hash status path
    else if (line.startsWith(':')) {
      const lineComponents = line.split(' ');
      const status = forceUnwrap('Invalid log output (status)', lineComponents.at(-1));
      const oldPath = /^R|C/.test(status)
        ? forceUnwrap('Missing old path', lines.at(++i))
        : undefined;

      const path = forceUnwrap('Missing path', lines.at(++i));

      files.push(new CommittedFileChange(
        path,
        {kind: mapStatus(status, oldPath), oldPath} as AppFileStatus,
        latestSha,
      ));
    }
    // Numstat line: added deleted path
    else {
      const match = /^(\d+|-)\t(\d+|-)\t/.exec(line);
      if (match) {
        const [, added, deleted] = match;
        linesAdded += added === '-' ? 0 : Number.parseInt(added);
        linesDeleted += deleted === '-' ? 0 : Number.parseInt(deleted);

        if (files[numStatCount] && isCopyOrRename(files[numStatCount].status)) {
          i += 2;
        }
        numStatCount++;
      }
    }
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

  workingDirectoryChanges
    .split('\0')
    .filter(Boolean) // Remove empty entries
    .forEach((entry) => {
      // Extract the two-character status (e.g., "M ", "MM", "??", "A ")
      const rawStatus = entry.substring(0, 2);
      const stagedStatus = rawStatus.charAt(0);
      const unstagedStatus = rawStatus.charAt(1);
      const path = entry.substring(2).trim();

      const fileChange = new WorkingDirectoryFileChange(
        path,
        {kind: mapPorcelainStatus(rawStatus)} as AppFileStatus,
      );

      // Push to staged/unstaged arrays if the status is non-empty
      if (['A', 'M', 'D', 'R', 'C'].includes(stagedStatus)) staged.push(fileChange);
      if (['M', '?'].includes(unstagedStatus)) unstaged.push(fileChange);
    });

  return {unstaged, staged};
};