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
import type {editor} from 'monaco-editor';
import {WorkingDirectoryService} from '../../services/git/working-directory.service';
import {idsToHide} from '../../utils/diff-editor.utils';
import {buildZeroContextPatch} from './monaco-patch-builder';
import {AppFileStatusKind, type FileChange, isCommittedFileChange, isWorkingDirectoryFileChange} from '../../lib/github-desktop/model/status';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {ToastService} from '../../services/toast.service';
import {GitApiService} from '../../services/git/git-api.service';
import {SettingsService} from '../../services/settings.service';
import {FileDiffPanelService} from '../../services/file-diff-panel.service';
import {permalink, remoteWebUrl} from '../../utils/permalink.utils';
import {DEFAULT_EDITOR_COMMAND, editorCommandArgs} from '../../utils/editor-command.utils';
import {parseRemote} from '../../utils/branch-utils';
import {firstValueFrom} from 'rxjs';
type IStandaloneCodeEditor = editor.IStandaloneCodeEditor;
type IStandaloneDiffEditor = editor.IStandaloneDiffEditor;
type ILineChange = editor.ILineChange;

// Monaco's internal context menu contribution: not part of its public API
interface ContextMenuController extends editor.IEditorContribution {
  _getMenuActions: (...args: unknown[]) => { id: string }[];
}

// Monaco's internal context menu contribution: not part of its public API
interface ContextMenuController extends editor.IEditorContribution {
  _getMenuActions: (...args: unknown[]) => { id: string }[];
}

@Injectable({providedIn: 'root'})
export class MonacoDiffRightClickActionsService {
  private workingDir = inject(WorkingDirectoryService);
  private currentRepo = inject(CurrentRepoStore);
  private toast = inject(ToastService);
  private gitApi = inject(GitApiService);
  private settings = inject(SettingsService);
  private fileDiffPanel = inject(FileDiffPanelService);

  registerEditorRightClick = (diffEditor: IStandaloneDiffEditor) => {
    let currentFile: FileChange | undefined;
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

    // File and lines under the cursor. The original side of a rename is the old path
    const location = (ed: IStandaloneCodeEditor) => {
      const selection = ed.getSelection();
      if (!currentFile || !selection) return undefined;
      const {status} = currentFile;
      const renamed = status.kind === AppFileStatusKind.Renamed || status.kind === AppFileStatusKind.Copied;
      const isOriginal = ed === diffEditor.getOriginalEditor();
      const path = renamed && isOriginal ? status.oldPath : currentFile.path;
      return {file: currentFile, path, isOriginal, start: selection.startLineNumber, end: selection.endLineNumber};
    };
    const lines = (start: number, end: number) => start === end ? `${start}` : `${start}-${end}`;
    const absolutePath = (path: string) => window.tauri.path.resolve(this.currentRepo.cwd()!, path);

    // '/repo/src/file.ts:12', or '/repo/src/file.ts:12-18' for several lines
    const copyReference = (ed: IStandaloneCodeEditor) => {
      const at = location(ed);
      if (at) this.copyToClipboard(`${absolutePath(at.path)}:${lines(at.start, at.end)}`);
    };

    const copyRelativeReference = (ed: IStandaloneCodeEditor) => {
      const at = location(ed);
      if (at) this.copyToClipboard(`${at.path}:${lines(at.start, at.end)}`);
    };

    // Link to the lines on the remote's website, at the commit shown on that side
    const copyPermalink = async (ed: IStandaloneCodeEditor) => {
      const at = location(ed);
      if (!at || !isCommittedFileChange(at.file)) return;
      const git = (args: string[]) => firstValueFrom(this.gitApi.git(args)).then(out => out.trim()).catch(() => '');

      const upstream = this.currentRepo.headBranch()?.upstream;
      const remote = upstream ? parseRemote(upstream).remote : 'origin';
      const webUrl = remoteWebUrl(await git(['remote', 'get-url', remote]));
      if (!webUrl) return this.toast.warn(`${remote} has no web page to link to`);

      const sha = await git(['rev-parse', at.isOriginal ? `${at.file.commitish}^` : at.file.commitish]);
      if (!sha) return this.toast.warn(`Can't find the commit shown on this side`);

      this.copyToClipboard(permalink(webUrl, sha, at.path, at.start, at.end));
      if (!await git(['branch', '-r', '--contains', sha])) this.toast.warn(`${sha.slice(0, 7)} isn't pushed yet: the link won't work until it is`);
    };

    const openInEditor = async (ed: IStandaloneCodeEditor) => {
      const at = location(ed);
      if (!at) return;
      const file = absolutePath(at.path);
      if (!await window.tauri.fs.exists(file)) return this.toast.warn(`${at.path} doesn't exist in the working directory`);
      const [cmd, ...args] = editorCommandArgs(this.settings.editorCommand.trim() || DEFAULT_EDITOR_COMMAND, file, at.start);
      window.tauri.spawn(cmd, args, {cwd: this.currentRepo.cwd()})
        .catch(e => this.toast.err(`Couldn't run the editor command (set it in Settings): ${e}`));
    };

    const blameLine = (ed: IStandaloneCodeEditor) => {
      const at = location(ed);
      if (!at) return;
      this.fileDiffPanel.blameLine.set(at.start);
      this.fileDiffPanel.blameOpen.set(true);
    };

    for (const ed of [diffEditor.getOriginalEditor(), diffEditor.getModifiedEditor()]) {
      ed.addAction({id: 'stage-line',     label: 'Stage this line',   contextMenuGroupId: 'modification', contextMenuOrder: 0.5, precondition: 'isWorkingDirFile && !isFileStaged && isSingleLine',  run: stageLines(true)});
      ed.addAction({id: 'stage-lines',    label: 'Stage lines',       contextMenuGroupId: 'modification', contextMenuOrder: 1,   precondition: 'isWorkingDirFile && !isFileStaged && !isSingleLine', run: stageLines(true)});
      ed.addAction({id: 'unstage-line',   label: 'Unstage this line', contextMenuGroupId: 'modification', contextMenuOrder: 0.5, precondition: 'isWorkingDirFile && isFileStaged && isSingleLine',   run: stageLines(false)});
      ed.addAction({id: 'unstage-lines',  label: 'Unstage lines',     contextMenuGroupId: 'modification', contextMenuOrder: 1,   precondition: 'isWorkingDirFile && isFileStaged && !isSingleLine',  run: stageLines(false)});
      ed.addAction({id: 'discard-line',   label: 'Discard this line', contextMenuGroupId: 'modification', contextMenuOrder: 1.5, precondition: 'isWorkingDirFile && !isFileStaged && isSingleLine',  run: discardLine});
      ed.addAction({id: 'discard-lines',  label: 'Discard lines',     contextMenuGroupId: 'modification', contextMenuOrder: 1.5, precondition: 'isWorkingDirFile && !isFileStaged && !isSingleLine', run: discardLine});
      ed.addAction({id: 'open-in-editor', label: 'Open in Editor at This Line', contextMenuGroupId: 'navigation', contextMenuOrder: 1, run: openInEditor});
      ed.addAction({id: 'copy-reference',          label: 'Copy Reference',          contextMenuGroupId: '9_cutcopypaste', contextMenuOrder: 5, run: copyReference});
      ed.addAction({id: 'copy-relative-reference', label: 'Copy Relative Reference', contextMenuGroupId: '9_cutcopypaste', contextMenuOrder: 6, run: copyRelativeReference});
      ed.addAction({id: 'copy-permalink',          label: 'Copy Permalink',          contextMenuGroupId: '9_cutcopypaste', contextMenuOrder: 7, precondition: '!isWorkingDirFile', run: copyPermalink});
      this.removeDefaultContextMenuActions(ed);
    }
    // Blame shows the modified side's version of the file
    diffEditor.getModifiedEditor().addAction({id: 'blame-line', label: 'Blame This Line', contextMenuGroupId: 'navigation', contextMenuOrder: 2, run: blameLine});

    // Returned updater — call whenever the selected file changes
    return (file: FileChange): void => {
      currentFile = file;
      isWorkingDirOrig.set(isWorkingDirectoryFileChange(file));
      isWorkingDirMod.set(isWorkingDirectoryFileChange(file));
      const staged = isWorkingDirectoryFileChange(file) && file.staged;
      isStagedOrig.set(staged);
      isStagedMod.set(staged);
    };
  };

  // WebKitGTK refuses navigator.clipboard from Monaco's context menu actions, execCommand still works there
  private copyToClipboard = (text: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (copied) this.toast.success(`Copied ${text}`);
    else this.toast.err(`Couldn't copy ${text}`);
  };

  private removeDefaultContextMenuActions = (ed: IStandaloneCodeEditor) => {
    // Re-bind context menu actions getter
    const contextmenu = ed.getContribution<ContextMenuController>('editor.contrib.contextmenu')!;
    const realMethod = contextmenu._getMenuActions.bind(contextmenu);
    contextmenu._getMenuActions = (...args) => realMethod(...args).filter(item => !idsToHide.has(item.id));
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
