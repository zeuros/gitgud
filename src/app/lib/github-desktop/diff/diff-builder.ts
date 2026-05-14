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

import {DiffType, IDiff, LineEndingsChange} from '../model/diff/diff-data';
import {FileChange} from '../model/status';
import {DiffParser} from './diff-parser';
import {isDiffTooLarge, isStringTooLarge, isValidBuffer} from './diff-utils';
import {forceUnwrap} from '../throw-ex';
import {IRawDiff} from '../model/diff/raw-diff';
import {beforeAndAfterText, convertDiff} from './diff-binary-image';

export function buildDiff(
  buffer: string,
  file: FileChange,
  oldestCommitish?: string,
  lineEndingsChange?: LineEndingsChange,
): IDiff {
  // if (file.status.submoduleStatus !== undefined) {
  //   return buildSubmoduleDiff(
  //     buffer,
  //     repository,
  //     file,
  //     file.status.submoduleStatus
  //   )
  // }

  if (!isValidBuffer(buffer)) {
    // the buffer's diff is too large to be renderable in the UI
    return {kind: DiffType.Unrenderable};
  }

  const diff = diffFromRawDiffOutput(buffer);

  if (isStringTooLarge(buffer) || isDiffTooLarge(diff)) {
    // we don't want to render by default
    // but we keep it as an option by
    // passing in text and hunks
    return {
      kind: DiffType.LargeText,
      text: diff.contents,
      beforeAfter: beforeAndAfterText(diff.contents, diff.hunks),
      hunks: diff.hunks,
      lineEndingsChange,
      maxLineNumber: diff.maxLineNumber,
    };
  }

  return convertDiff(file, diff, oldestCommitish, lineEndingsChange);
}


const diffFromRawDiffOutput = (output: string): IRawDiff => {
  // for now we just assume the diff is UTF-8, but given we have the raw buffer
  // we can try and convert this into other encodings in the future
  const pieces = output.split('\0');
  return (new DiffParser()).parse(forceUnwrap(`Invalid diff output`, pieces.at(-1)));
};