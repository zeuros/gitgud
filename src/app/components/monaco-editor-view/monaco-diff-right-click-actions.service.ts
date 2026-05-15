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

import {inject, Injectable} from '@angular/core';
import {editor} from 'monaco-editor';
import {WorkingDirectoryService} from '../../services/electron-cmd-parser-layer/working-directory.service';
import {WorkingDirectoryFileChange} from '../../lib/github-desktop/model/workdir';
import {idsToHide} from '../../utils/diff-editor.utils';
import {realLine} from './monaco-utils';
import IStandaloneCodeEditor = editor.IStandaloneCodeEditor;
import IStandaloneDiffEditor = editor.IStandaloneDiffEditor;
import ITextModel = editor.ITextModel;
import ILineChange = editor.ILineChange;

@Injectable({providedIn: 'root'})
export class MonacoDiffRightClickActionsService {
  private workingDir = inject(WorkingDirectoryService);

  registerEditorRightClick = (diffEditor: IStandaloneDiffEditor) => {
    let currentFile: WorkingDirectoryFileChange | undefined;
    let lineChanges: ILineChange[] | null = null;

    diffEditor.onDidUpdateDiff(() => lineChanges = diffEditor.getLineChanges());

    this.attachGutterSelectionHighlight(diffEditor.getModifiedEditor(), diffEditor.getOriginalEditor());

    // Context keys must exist on both sub-editors — each has its own context scope
    const isStagedOrig = diffEditor.getOriginalEditor().createContextKey<boolean>('isFileStaged', false);
    const isStagedMod = diffEditor.getModifiedEditor().createContextKey<boolean>('isFileStaged', false);
    const isSingleLineOrig = diffEditor.getOriginalEditor().createContextKey<boolean>('isSingleLine', false);
    const isSingleLineMod = diffEditor.getModifiedEditor().createContextKey<boolean>('isSingleLine', false);

    diffEditor.getOriginalEditor().onDidChangeCursorSelection(({selection}) =>
      isSingleLineOrig.set(selection.startLineNumber === selection.endLineNumber));
    diffEditor.getModifiedEditor().onDidChangeCursorSelection(({selection}) =>
      isSingleLineMod.set(selection.startLineNumber === selection.endLineNumber));

    const buildPatch = (ed: IStandaloneCodeEditor, stage: boolean) => {
      const selection = ed.getSelection();
      const originalModel = diffEditor.getOriginalEditor().getModel();
      const modifiedModel = diffEditor.getModifiedEditor().getModel();
      if (!currentFile || !selection || !lineChanges || !originalModel || !modifiedModel) return null;
      return this.buildZeroContextPatch(
        lineChanges, originalModel, modifiedModel,
        selection.startLineNumber, selection.endLineNumber,
        currentFile.path, stage,
      );
    };

    const stageLines = (stage: boolean) => (ed: IStandaloneCodeEditor) => {
      const patch = buildPatch(ed, stage);
      if (patch) this.workingDir.stageChangesWithPatch(patch, stage);
    };

    const discardLine = (ed: IStandaloneCodeEditor) => {
      const patch = buildPatch(ed, true);
      if (patch) this.workingDir.discardChangesWithPatch(patch);
    };

    for (const ed of [diffEditor.getOriginalEditor(), diffEditor.getModifiedEditor()]) {
      ed.addAction({id: 'stage-line',     label: 'Stage this line',   contextMenuGroupId: 'modification', contextMenuOrder: 0.5, precondition: '!isFileStaged && isSingleLine',  run: stageLines(true)});
      ed.addAction({id: 'stage-lines',    label: 'Stage lines',       contextMenuGroupId: 'modification', contextMenuOrder: 1,   precondition: '!isFileStaged && !isSingleLine', run: stageLines(true)});
      ed.addAction({id: 'unstage-line',   label: 'Unstage this line', contextMenuGroupId: 'modification', contextMenuOrder: 0.5, precondition: 'isFileStaged && isSingleLine',   run: stageLines(false)});
      ed.addAction({id: 'unstage-lines',  label: 'Unstage lines',     contextMenuGroupId: 'modification', contextMenuOrder: 1,   precondition: 'isFileStaged && !isSingleLine',  run: stageLines(false)});
      ed.addAction({id: 'discard-line',   label: 'Discard this line', contextMenuGroupId: 'modification', contextMenuOrder: 1.5, precondition: '!isFileStaged && isSingleLine',  run: discardLine});
      ed.addAction({id: 'discard-lines',  label: 'Discard lines',     contextMenuGroupId: 'modification', contextMenuOrder: 1.5, precondition: '!isFileStaged && !isSingleLine', run: discardLine});
      this.removeDefaultContextMenuActions(ed);
    }

    // Returned updater — call whenever the selected file changes
    return (file: WorkingDirectoryFileChange): void => {
      currentFile = file;
      isStagedOrig.set(file.staged ?? false);
      isStagedMod.set(file.staged ?? false);
    };
  };

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
  buildZeroContextPatch(
    changes: ILineChange[],
    originalModel: ITextModel, // HEAD / index content  (original editor)
    modifiedModel: ITextModel, // working dir content   (modified editor)
    startLine: number,
    endLine: number,
    filePath: string,
    stage: boolean,
  ): string | null {
    const countSuffix = (n: number) => n === 1 ? '' : `,${n}`;
    const hunks: string[] = [];

    for (const change of changes) {
      const origStart = change.originalStartLineNumber;
      const origEnd = change.originalEndLineNumber;
      const modStart = change.modifiedStartLineNumber;
      const modEnd = change.modifiedEndLineNumber;

      const isPureInsertion = origEnd === 0; // hunk has nothing removed in original side
      const isPureDeletion = modEnd === 0;  // hunk has nothing added in modified side
      const oldCount = origEnd - origStart + 1;
      const newCount = modEnd - modStart + 1;

      if (stage) {
        if (isPureDeletion) continue; // nothing to stage on the add side
        if (endLine < modStart || startLine > modEnd) continue; // selection doesn't overlap

        if (isPureInsertion) {
          // Only + lines — no old content to remove
          const selStart = Math.max(startLine, modStart);
          const selEnd = Math.min(endLine, modEnd);
          const lines = [];
          for (let i = selStart; i <= selEnd; i++) lines.push('+' + realLine(modifiedModel, i));
          // origStart = first old line after the gap; subtract 1 → "insert after this line"
          hunks.push(`@@ -${Math.max(0, origStart - 1)},0 +${selStart}${countSuffix(lines.length)} @@\n${lines.join('\n')}\n`);
        } else if (oldCount === newCount) {
          // Equal-count replacement: 1-to-1 line correspondence by offset →
          // stage only the selected line pairs instead of the whole hunk
          const selStart = Math.max(startLine, modStart);
          const selEnd = Math.min(endLine, modEnd);
          for (let modLine = selStart; modLine <= selEnd; modLine++) {
            const origLine = origStart + (modLine - modStart);
            hunks.push(`@@ -${origLine} +${modLine} @@\n${'-' + realLine(originalModel, origLine)}\n${'+' + realLine(modifiedModel, modLine)}\n`);
          }
        } else {
          // Unequal-count replacement: all old lines must be removed atomically;
          // only stage the selected new lines (unselected ones remain as unstaged insertions)
          const selStart = Math.max(startLine, modStart);
          const selEnd = Math.min(endLine, modEnd);
          const oldLines: string[] = [];
          for (let i = origStart; i <= origEnd; i++) oldLines.push('-' + realLine(originalModel, i));
          const newLines: string[] = [];
          for (let i = selStart; i <= selEnd; i++) newLines.push('+' + realLine(modifiedModel, i));
          const selCount = selEnd - selStart + 1;
          hunks.push(`@@ -${origStart}${countSuffix(oldCount)} +${modStart}${countSuffix(selCount)} @@\n${[...oldLines, ...newLines].join('\n')}\n`);
        }
      } else {
        if (isPureInsertion) {
          // Lines added to index but not in HEAD; user selects them in the modified editor
          if (endLine < modStart || startLine > modEnd) continue;
          const selStart = Math.max(startLine, modStart);
          const selEnd = Math.min(endLine, modEnd);
          const lines = [];
          for (let i = selStart; i <= selEnd; i++) lines.push('+' + realLine(modifiedModel, i));
          // Forward patch; git apply -R --cached reverses it → removes lines from index
          hunks.push(`@@ -${Math.max(0, origStart - 1)},0 +${selStart}${countSuffix(lines.length)} @@\n${lines.join('\n')}\n`);
          continue;
        }
        if (endLine < origStart || startLine > origEnd) continue; // selection doesn't overlap

        if (isPureDeletion) {
          // Only - lines — no new content to add back
          const selStart = Math.max(startLine, origStart);
          const selEnd = Math.min(endLine, origEnd);
          const lines = [];
          for (let i = selStart; i <= selEnd; i++) lines.push('-' + realLine(originalModel, i));
          // modStart = first new line after the gap; subtract 1 → "insert after this line"
          hunks.push(`@@ -${selStart}${countSuffix(lines.length)} +${Math.max(0, modStart - 1)},0 @@\n${lines.join('\n')}\n`);
        } else if (oldCount === newCount) {
          // Equal-count replacement: unstage individual line pairs within the selection
          const selStart = Math.max(startLine, origStart);
          const selEnd = Math.min(endLine, origEnd);
          for (let origLine = selStart; origLine <= selEnd; origLine++) {
            const modLine = modStart + (origLine - origStart);
            hunks.push(`@@ -${origLine} +${modLine} @@\n${'-' + realLine(originalModel, origLine)}\n${'+' + realLine(modifiedModel, modLine)}\n`);
          }
        } else {
          // Unequal-count replacement: full hunk — git apply -R --cached will reverse it
          const oldLines: string[] = [];
          for (let i = origStart; i <= origEnd; i++) oldLines.push('-' + realLine(originalModel, i));
          const newLines: string[] = [];
          for (let i = modStart; i <= modEnd; i++) newLines.push('+' + realLine(modifiedModel, i));
          hunks.push(`@@ -${origStart}${countSuffix(oldCount)} +${modStart}${countSuffix(newCount)} @@\n${[...oldLines, ...newLines].join('\n')}\n`);
        }
      }
    }

    if (!hunks.length) return null;
    return `--- a/${filePath}\n+++ b/${filePath}\n${hunks.join('')}`;
  }

  private removeDefaultContextMenuActions = (ed: IStandaloneCodeEditor) => {
    // Re-bind context menu actions getter
    const contextmenu = ed.getContribution<any>('editor.contrib.contextmenu');
    const realMethod = contextmenu._getMenuActions.bind(contextmenu);
    contextmenu._getMenuActions = (...args: unknown[]) => realMethod(...args).filter((item: { id: string }) => !idsToHide.has(item.id));
  };

  private attachGutterSelectionHighlight(modified: IStandaloneCodeEditor, original: IStandaloneCodeEditor): void {
    const modDec = modified.createDecorationsCollection([]);
    const origDec = original.createDecorationsCollection([]);
    const opts = {marginClassName: 'gutter-selection-highlight'};

    modified.onDidChangeCursorSelection(({selection}) => {
      modDec.set([{range: selection, options: opts}]);
      origDec.set([{range: selection, options: opts}]);
    });

    original.onDidChangeCursorSelection(({selection}) => {
      origDec.set([{range: selection, options: opts}]);
      modDec.set([{range: selection, options: opts}]);
    });
  }
}
