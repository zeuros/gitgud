import {IRawDiff} from '../model/diff/raw-diff';


/**
 * V8 has a limit on the size of string it can create (~256MB), and unless we want to
 * trigger an unhandled exception we need to do the encoding conversion by hand.
 *
 * This is a hard limit on how big a buffer can be and still be converted into
 * a string.
 */
const MaxDiffstringSize = 70e6; // 70MB in decimal

/**
 * Where `MaxDiffstringSize` is a hard limit, this is a suggested limit. Diffs
 * bigger than this _could_ be displayed but it might cause some slowness.
 */
const MaxReasonableDiffSize = MaxDiffstringSize / 16; // ~4.375MB in decimal

/**
 * The longest line length we should try to display. If a diff has a line longer
 * than this, we probably shouldn't attempt it
 */
const MaxCharactersPerLine = 5000;

/**
 * Utility function to check whether parsing this buffer is going to cause
 * issues at runtime.
 *
 * @param buffer A buffer of binary text from a spawned process
 */
export const isValidBuffer = (buffer: string) => buffer.length <= MaxDiffstringSize;

/** Is the buffer too large for us to reasonably represent? */
export const isStringTooLarge = (buffer: string) => buffer.length >= MaxReasonableDiffSize;

/** Is the diff too large for us to reasonably represent? */
export const isDiffTooLarge = (diff: IRawDiff) => {
  for (const hunk of diff.hunks) {
    for (const line of hunk.lines) {
      if (line.text.length > MaxCharactersPerLine) {
        return true;
      }
    }
  }

  return false;
};