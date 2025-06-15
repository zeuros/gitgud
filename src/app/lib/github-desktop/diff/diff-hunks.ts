import {DiffHunk, DiffHunkExpansionType, DiffHunkHeader} from '../model/diff/raw-diff';

/** How many new lines will be added to a diff hunk by default. */
export const DefaultDiffExpansionStep = 20;

/**
 * Calculates whether or not a hunk header can be expanded up, down, both, or if
 * the space represented by the hunk header is short and expansion there would
 * mean merging with the hunk above.
 *
 * @param hunkIndex     Index of the hunk to evaluate within the whole diff.
 * @param hunkHeader    Header of the hunk to evaluate.
 * @param previousHunk  Hunk previous to the one to evaluate. Null if the
 *                      evaluated hunk is the first one.
 */
export function getHunkHeaderExpansionType(
  hunkIndex: number,
  hunkHeader: DiffHunkHeader,
  previousHunk: DiffHunk | null,
) {
  const distanceToPrevious =
    previousHunk === null
      ? Infinity
      : hunkHeader.oldStartLine -
      previousHunk.header.oldStartLine -
      previousHunk.header.oldLineCount;

  // In order to simplify the whole logic around expansion, only the hunk at the
  // top can be expanded up exclusively, and only the hunk at the bottom (the
  // dummy one, see getTextDiffWithBottomDummyHunk) can be expanded down
  // exclusively.
  // The rest of the hunks can be expanded both ways, except those which are too
  // short and therefore the direction of expansion doesn't matter.
  if (hunkIndex === 0) {
    // The top hunk can only be expanded if there is content above it
    if (hunkHeader.oldStartLine > 1 && hunkHeader.newStartLine > 1) {
      return DiffHunkExpansionType.Up;
    } else {
      return DiffHunkExpansionType.None;
    }
  } else if (distanceToPrevious <= DefaultDiffExpansionStep) {
    return DiffHunkExpansionType.Short;
  } else {
    return DiffHunkExpansionType.Both;
  }
}