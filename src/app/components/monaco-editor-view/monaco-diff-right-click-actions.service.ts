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
import {buildZeroContextPatch} from './monaco-patch-builder';
import {isWorkingDirectoryFileChange} from '../../lib/github-desktop/model/status';
import IStandaloneCodeEditor = editor.IStandaloneCodeEditor;
import IStandaloneDiffEditor = editor.IStandaloneDiffEditor;
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
    const isWorkingDirOrig = diffEditor.getOriginalEditor().createContextKey<boolean>('isWorkingDirFile', false);
    const isWorkingDirMod = diffEditor.getModifiedEditor().createContextKey<boolean>('isWorkingDirFile', false);

    diffEditor.getOriginalEditor().onDidChangeCursorSelection(({selection}) =>
      isSingleLineOrig.set(selection.startLineNumber === selection.endLineNumber));
    diffEditor.getModifiedEditor().onDidChangeCursorSelection(({selection}) =>
      isSingleLineMod.set(selection.startLineNumber === selection.endLineNumber));

    const buildPatch = (ed: IStandaloneCodeEditor, stage: boolean) => {
      const selection = ed.getSelection();
      const originalModel = diffEditor.getOriginalEditor().getModel();
      const modifiedModel = diffEditor.getModifiedEditor().getModel();
      if (!currentFile || !selection || !lineChanges || !originalModel || !modifiedModel) return null;
      const inOriginalEditor = ed === diffEditor.getOriginalEditor();
      return buildZeroContextPatch(
        lineChanges, originalModel, modifiedModel,
        selection.startLineNumber, selection.endLineNumber,
        currentFile.path, stage, inOriginalEditor,
      );
    };

    const stageLines = (stage: boolean) => (ed: IStandaloneCodeEditor) => {
      const patch = buildPatch(ed, stage);
      if (patch) this.workingDir.stageChangesWithPatch(patch, stage);
    };

    const discardLine = (ed: IStandaloneCodeEditor) => {
      const patch = buildPatch(ed, false);
      if (patch) this.workingDir.discardChangesWithPatch(patch);
    };

    for (const ed of [diffEditor.getOriginalEditor(), diffEditor.getModifiedEditor()]) {
      ed.addAction({id: 'stage-line',     label: 'Stage this line',   contextMenuGroupId: 'modification', contextMenuOrder: 0.5, precondition: 'isWorkingDirFile && !isFileStaged && isSingleLine',  run: stageLines(true)});
      ed.addAction({id: 'stage-lines',    label: 'Stage lines',       contextMenuGroupId: 'modification', contextMenuOrder: 1,   precondition: 'isWorkingDirFile && !isFileStaged && !isSingleLine', run: stageLines(true)});
      ed.addAction({id: 'unstage-line',   label: 'Unstage this line', contextMenuGroupId: 'modification', contextMenuOrder: 0.5, precondition: 'isWorkingDirFile && isFileStaged && isSingleLine',   run: stageLines(false)});
      ed.addAction({id: 'unstage-lines',  label: 'Unstage lines',     contextMenuGroupId: 'modification', contextMenuOrder: 1,   precondition: 'isWorkingDirFile && isFileStaged && !isSingleLine',  run: stageLines(false)});
      ed.addAction({id: 'discard-line',   label: 'Discard this line', contextMenuGroupId: 'modification', contextMenuOrder: 1.5, precondition: 'isWorkingDirFile && !isFileStaged && isSingleLine',  run: discardLine});
      ed.addAction({id: 'discard-lines',  label: 'Discard lines',     contextMenuGroupId: 'modification', contextMenuOrder: 1.5, precondition: 'isWorkingDirFile && !isFileStaged && !isSingleLine', run: discardLine});
      this.removeDefaultContextMenuActions(ed);
    }

    // Returned updater — call whenever the selected file changes
    return (file: WorkingDirectoryFileChange): void => {
      currentFile = file;
      isWorkingDirOrig.set(isWorkingDirectoryFileChange(file));
      isWorkingDirMod.set(isWorkingDirectoryFileChange(file));
      isStagedOrig.set(file?.staged ?? false);
      isStagedMod.set(file?.staged ?? false);
    };
  };

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
