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
  const oldCount = origEnd - origStart + 1;
  const newCount = modEnd - modStart + 1;

  if (isPureDeletion) return null;                          // nothing to stage on the add side
  if (endLine < modStart || startLine > modEnd) return null; // selection doesn't overlap

  if (isPureInsertion) {
    // Only + lines — no old content to remove
    const selStart = Math.max(startLine, modStart);
    const selEnd = Math.min(endLine, modEnd);
    const lines: string[] = [];
    for (let i = selStart ; i <= selEnd ; i++) lines.push('+' + realLine(modifiedModel, i));
    // origStart = first old line after the gap; subtract 1 → "insert after this line"
    return `@@ -${Math.max(0, origStart - 1)},0 +${selStart}${countSuffix(lines.length)} @@\n${lines.join('\n')}\n`;
  }

  if (oldCount === newCount) {
    // Equal-count replacement: 1-to-1 line correspondence by offset →
    // stage only the selected line pairs instead of the whole hunk
    const selStart = Math.max(startLine, modStart);
    const selEnd = Math.min(endLine, modEnd);
    const hunks: string[] = [];
    for (let modLine = selStart ; modLine <= selEnd ; modLine++) {
      const origLine = origStart + (modLine - modStart);
      hunks.push(`@@ -${origLine} +${modLine} @@\n${'-' + realLine(originalModel, origLine)}\n${'+' + realLine(modifiedModel, modLine)}\n`);
    }
    return hunks.join('');
  }

  // Unequal-count replacement: all old lines must be removed atomically;
  // only stage the selected new lines (unselected ones remain as unstaged insertions)
  const selStart = Math.max(startLine, modStart);
  const selEnd = Math.min(endLine, modEnd);
  const oldLines: string[] = [];
  for (let i = origStart ; i <= origEnd ; i++) oldLines.push('-' + realLine(originalModel, i));
  const newLines: string[] = [];
  for (let i = selStart ; i <= selEnd ; i++) newLines.push('+' + realLine(modifiedModel, i));
  const selCount = selEnd - selStart + 1;
  return `@@ -${origStart}${countSuffix(oldCount)} +${modStart}${countSuffix(selCount)} @@\n${[...oldLines, ...newLines].join('\n')}\n`;
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
  const oldCount = origEnd - origStart + 1;
  const newCount = modEnd - modStart + 1;

  if (isPureInsertion) {
    // Lines added to index but not in HEAD; user selects them in the modified editor.
    // Forward patch; git apply -R --cached reverses it → removes lines from index.
    if (endLine < modStart || startLine > modEnd) return null;
    const selStart = Math.max(startLine, modStart);
    const selEnd = Math.min(endLine, modEnd);
    const lines: string[] = [];
    for (let i = selStart ; i <= selEnd ; i++) lines.push('+' + realLine(modifiedModel, i));
    return `@@ -${Math.max(0, origStart - 1)},0 +${selStart}${countSuffix(lines.length)} @@\n${lines.join('\n')}\n`;
  }

  // In modified editor (inline view) deletion coords are mod-based; otherwise orig-based
  if (inOriginalEditor) {
    if (endLine < origStart || startLine > origEnd) return null;
  } else {
    if (startLine > modStart || endLine < modStart) return null;
  }

  if (isPureDeletion) {
    // Only - lines — no new content to add back.
    // When coming from modified editor we can't partially select within a deletion block.
    const selStart = inOriginalEditor ? Math.max(startLine, origStart) : origStart;
    const selEnd = inOriginalEditor ? Math.min(endLine, origEnd) : origEnd;
    const lines: string[] = [];
    for (let i = selStart ; i <= selEnd ; i++) lines.push('-' + realLine(originalModel, i));
    // modStart = first new line after the gap; subtract 1 → "insert after this line"
    return `@@ -${selStart}${countSuffix(lines.length)} +${Math.max(0, modStart - 1)},0 @@\n${lines.join('\n')}\n`;
  }

  if (oldCount === newCount) {
    // Equal-count replacement: unstage individual line pairs within the selection
    const selStart = Math.max(startLine, origStart);
    const selEnd = Math.min(endLine, origEnd);
    const hunks: string[] = [];
    for (let origLine = selStart ; origLine <= selEnd ; origLine++) {
      const modLine = modStart + (origLine - origStart);
      hunks.push(`@@ -${origLine} +${modLine} @@\n${'-' + realLine(originalModel, origLine)}\n${'+' + realLine(modifiedModel, modLine)}\n`);
    }
    return hunks.join('');
  }

  // Unequal-count replacement: full hunk — git apply -R --cached will reverse it
  const oldLines: string[] = [];
  for (let i = origStart ; i <= origEnd ; i++) oldLines.push('-' + realLine(originalModel, i));
  const newLines: string[] = [];
  for (let i = modStart ; i <= modEnd ; i++) newLines.push('+' + realLine(modifiedModel, i));
  return `@@ -${origStart}${countSuffix(oldCount)} +${modStart}${countSuffix(newCount)} @@\n${[...oldLines, ...newLines].join('\n')}\n`;
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