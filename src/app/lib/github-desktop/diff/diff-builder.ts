import {DiffType, IDiff, ILargeTextDiff, LineEndingsChange} from '../model/diff/diff-data';
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
    const largeTextDiff: ILargeTextDiff = {
      kind: DiffType.LargeText,
      text: diff.contents,
      beforeAfter: beforeAndAfterText(diff.contents, diff.hunks),
      hunks: diff.hunks,
      lineEndingsChange,
      maxLineNumber: diff.maxLineNumber,
    };

    return largeTextDiff;
  }

  return convertDiff(file, diff, oldestCommitish, lineEndingsChange);
}


const diffFromRawDiffOutput = (output: string): IRawDiff => {
  // for now we just assume the diff is UTF-8, but given we have the raw buffer
  // we can try and convert this into other encodings in the future
  const pieces = output.split('\0');
  return (new DiffParser()).parse(forceUnwrap(`Invalid diff output`, pieces.at(-1)));
};