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

import {CommittedFileChange} from './model/change-set';
import {forceUnwrap} from './throw-ex';
import {isCopyOrRename, mapStatus} from './log';
import {IndexStatus} from './model/diff-index';
import {AppFileStatus} from './model/status';

export const parseRawLogWithNumstat = (rawFileChanges: string, sha: string) => {
  const files = new Array<CommittedFileChange>();
  let linesAdded = 0;
  let linesDeleted = 0;
  let numStatCount = 0;
  const lines = rawFileChanges.split('\0');

  for (let i = 0 ; i < lines.length - 1 ; i++) {
    const line = lines[i];
    if (line.startsWith(':')) {
      const lineComponents = line.split(' ');
      const status = forceUnwrap('Invalid log output (status)', lineComponents.at(-1));
      const oldPath = /^R|C/.test(status)
        ? forceUnwrap('Missing old path', lines.at(++i))
        : undefined;

      const path = forceUnwrap('Missing path', lines.at(++i));

      files.push(new CommittedFileChange(path, {kind: mapStatus(status, oldPath), oldPath} as AppFileStatus, sha));
    } else {
      const match = /^(\d+|-)\t(\d+|-)\t/.exec(line);
      const [, added, deleted] = forceUnwrap('Invalid numstat line', match);
      linesAdded += added === '-' ? 0 : parseInt(added, 10);
      linesDeleted += deleted === '-' ? 0 : parseInt(deleted, 10);

      // If this entry denotes a rename or copy the old and new paths are on
      // two separate fields (separated by \0). Otherwise, they're on the same
      // line as the added and deleted lines.
      if (isCopyOrRename(files[numStatCount].status)) {
        i += 2;
      }
      numStatCount++;
    }
  }

  return {files, linesAdded, linesDeleted};
};

type FilesAndStatuses = { [key: string]: IndexStatus };

export const parseIndexChanges = (indexChangesRawResult: string): FilesAndStatuses => {

  const map: FilesAndStatuses = {};

  const pieces = indexChangesRawResult.split('\0');

  for (let i = 0 ; i < pieces.length - 1 ; i += 2) {
    const path = pieces[i + 1];

    if (pieces[i]) map[path] = pieces[i] as IndexStatus;
  }

  return map;
};