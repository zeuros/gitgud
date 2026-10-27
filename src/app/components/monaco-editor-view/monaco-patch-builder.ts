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

import type {editor} from 'monaco-editor';

type ITextModel = editor.ITextModel;
type ILineChange = editor.ILineChange;

// ␍ (U+240D) is substituted for \r before content reaches Monaco so it renders visibly.
// Patch bytes need the real \r back.
const realLine = (model: ITextModel, i: number) => model.getLineContent(i).replace(/␍/g, '\r');

// Lines from..to of a model, each prefixed with + or -
const prefixedLines = (model: ITextModel, prefix: '+' | '-', from: number, to: number) => {
  const lines: string[] = [];
  for (let i = from ; i <= to ; i++) lines.push(prefix + realLine(model, i));
  return lines;
};

// Hunk adding the modified lines from..to. origStart = first old line after the gap; subtract 1 → "insert after this line"
const insertionHunk = (modifiedModel: ITextModel, origStart: number, from: number, to: number, countSuffix: (n: number) => string) => {
  const lines = prefixedLines(modifiedModel, '+', from, to);
  return `@@ -${Math.max(0, origStart - 1)},0 +${from}${countSuffix(lines.length)} @@\n${lines.join('\n')}\n`;
};

// One mini-hunk per line pair of an equal-count replacement: original line origFrom + k became modified line modFrom + k
const linePairHunks = (originalModel: ITextModel, modifiedModel: ITextModel, origFrom: number, modFrom: number, pairCount: number) => {
  const hunks: string[] = [];
  for (let k = 0 ; k < pairCount ; k++) {
    const origLine = origFrom + k;
    const modLine = modFrom + k;
    hunks.push(`@@ -${origLine} +${modLine} @@\n-${realLine(originalModel, origLine)}\n+${realLine(modifiedModel, modLine)}\n`);
  }
  return hunks.join('');
};

// Hunk of a replacement starting at origStart / modStart: removes original lines origStart..origEnd, adds modified lines modFrom..modTo
const replacementHunk = (
  originalModel: ITextModel, modifiedModel: ITextModel,
  origStart: number, origEnd: number, modStart: number, modFrom: number, modTo: number,
  countSuffix: (n: number) => string,
) => {
  const lines = [...prefixedLines(originalModel, '-', origStart, origEnd), ...prefixedLines(modifiedModel, '+', modFrom, modTo)];
  return `@@ -${origStart}${countSuffix(origEnd - origStart + 1)} +${modStart}${countSuffix(modTo - modFrom + 1)} @@\n${lines.join('\n')}\n`;
};

/**
 * Builds the hunk string(s) for a single change when staging (apply --cached).
 * Selection is expressed in modified-editor coordinates.
 *
 * - Pure deletion : skipped — nothing to stage on the add side.
 * - Pure insertion: clamp to selection, emit + lines only.
 * - Equal-count   : emit one mini-hunk per selected line pair (1-to-1 by offset).
 * - Unequal-count : all − lines must go atomically; only selected + lines are included
 *                   (unselected ones remain as unstaged insertions).
 *
 * Returns null when the change is outside the selection or has nothing to stage.
 */
export function stageHunk(
  change: ILineChange,
  originalModel: ITextModel,
  modifiedModel: ITextModel,
  startLine: number,
  endLine: number,
  countSuffix: (n: number) => string,
): string | null {
  const {
    originalStartLineNumber: origStart, originalEndLineNumber: origEnd,
    modifiedStartLineNumber: modStart, modifiedEndLineNumber: modEnd,
  } = change;

  const isPureInsertion = origEnd === 0; // hunk has nothing removed in original side
  const isPureDeletion = modEnd === 0;  // hunk has nothing added in modified side

  if (isPureDeletion) return null;                          // nothing to stage on the add side
  if (endLine < modStart || startLine > modEnd) return null; // selection doesn't overlap

  const selStart = Math.max(startLine, modStart);
  const selEnd = Math.min(endLine, modEnd);

  // Only + lines — no old content to remove
  if (isPureInsertion) return insertionHunk(modifiedModel, origStart, selStart, selEnd, countSuffix);

  // Equal-count replacement: 1-to-1 line correspondence by offset →
  // stage only the selected line pairs instead of the whole hunk
  if (origEnd - origStart === modEnd - modStart) {
    return linePairHunks(originalModel, modifiedModel, origStart + (selStart - modStart), selStart, selEnd - selStart + 1);
  }

  // Unequal-count replacement: all old lines must be removed atomically;
  // only stage the selected new lines (unselected ones remain as unstaged insertions)
  return replacementHunk(originalModel, modifiedModel, origStart, origEnd, modStart, selStart, selEnd, countSuffix);
}

/**
 * Builds the hunk string(s) for a single change when unstaging (apply -R --cached)
 * or discarding (apply -R).
 * Selection is in original-editor coordinates by default; modified-editor coords
 * are used only when inOriginalEditor=false (inline deletion blocks in modified view).
 *
 * - Pure insertion: emit the + lines so git apply -R removes them from the index.
 * - Pure deletion : clamp to selection (partial unstage/discard of removed lines).
 * - Equal-count   : emit one mini-hunk per selected line pair (1-to-1 by offset).
 * - Unequal-count : full hunk — git apply -R will reverse the whole replacement.
 *
 * Returns null when the change is outside the selection.
 */
export function unstageHunk(
  change: ILineChange,
  originalModel: ITextModel,
  modifiedModel: ITextModel,
  startLine: number,
  endLine: number,
  countSuffix: (n: number) => string,
  inOriginalEditor: boolean,
): string | null {
  const {
    originalStartLineNumber: origStart, originalEndLineNumber: origEnd,
    modifiedStartLineNumber: modStart, modifiedEndLineNumber: modEnd,
  } = change;

  const isPureInsertion = origEnd === 0; // hunk has nothing removed in original side
  const isPureDeletion = modEnd === 0;  // hunk has nothing added in modified side

  if (isPureInsertion) {
    // Lines added to index but not in HEAD; user selects them in the modified editor.
    // Forward patch; git apply -R --cached reverses it → removes lines from index.
    if (endLine < modStart || startLine > modEnd) return null;
    return insertionHunk(modifiedModel, origStart, Math.max(startLine, modStart), Math.min(endLine, modEnd), countSuffix);
  }

  // In modified editor (inline view) deletion coords are mod-based; otherwise orig-based
  const overlapsSelection = inOriginalEditor
    ? endLine >= origStart && startLine <= origEnd
    : startLine <= modStart && endLine >= modStart;
  if (!overlapsSelection) return null;

  const selStart = Math.max(startLine, origStart);
  const selEnd = Math.min(endLine, origEnd);

  if (isPureDeletion) {
    // Only - lines — no new content to add back.
    // When coming from modified editor we can't partially select within a deletion block.
    const [from, to] = inOriginalEditor ? [selStart, selEnd] : [origStart, origEnd];
    const lines = prefixedLines(originalModel, '-', from, to);
    // modStart = first new line after the gap; subtract 1 → "insert after this line"
    return `@@ -${from}${countSuffix(lines.length)} +${Math.max(0, modStart - 1)},0 @@\n${lines.join('\n')}\n`;
  }

  // Equal-count replacement: unstage individual line pairs within the selection
  if (origEnd - origStart === modEnd - modStart) {
    return linePairHunks(originalModel, modifiedModel, selStart, modStart + (selStart - origStart), selEnd - selStart + 1);
  }

  // Unequal-count replacement: full hunk — git apply -R --cached will reverse it
  return replacementHunk(originalModel, modifiedModel, origStart, origEnd, modStart, modStart, modEnd, countSuffix);
}

/**
 * Builds a zero-context (-U0) patch from Monaco's computed diff for the selected line range.
 *
 * - Pure insertions/deletions: clamp to the selection range.
 * - Equal-count replacements: emit one mini-hunk per selected line pair (1-to-1 by offset).
 * - Unequal-count replacements: emit all `-` lines + only the selected `+` lines.
 *
 * stage=true  → selection in modified editor; apply --cached
 * stage=false → selection in original editor; apply -R --cached
 */
export function buildZeroContextPatch(
  changes: ILineChange[],
  originalModel: ITextModel, // HEAD / index content  (original editor)
  modifiedModel: ITextModel, // working dir content   (modified editor)
  startLine: number,
  endLine: number,
  filePath: string,
  stage: boolean,
  inOriginalEditor = true,
): string | null {
  const countSuffix = (n: number) => n === 1 ? '' : `,${n}`;

  const hunkFn = (change: ILineChange) => stage
    ? stageHunk(change, originalModel, modifiedModel, startLine, endLine, countSuffix)
    : unstageHunk(change, originalModel, modifiedModel, startLine, endLine, countSuffix, inOriginalEditor);

  const hunks = changes.map(hunkFn).filter((h): h is string => h !== null);
  if (!hunks.length) return null;
  return `--- a/${filePath}\n+++ b/${filePath}\n${hunks.join('')}`;
}