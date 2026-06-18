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

import {type AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, HostListener, inject, input, type OnDestroy, signal, ViewChild} from '@angular/core';
import {CommittedFileChange, FileChange, isCommittedFileChange, isWorkingDirectoryFileChange} from '../../lib/github-desktop/model/status';
import {editor, Uri} from 'monaco-editor';
import {FileDiffService} from '../../services/file-diff.service';
import {FormsModule} from '@angular/forms';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {WorkingDirectoryFileChange} from '../../lib/github-desktop/model/workdir';
import {combineLatest, from} from 'rxjs';
import {MonacoDiffRightClickActionsService} from './monaco-diff-right-click-actions.service';
import {FileDiffPanelService} from '../../services/file-diff-panel.service';
import {type ViewType} from '../../models/git-repository';
import {registerMonacoEditorThemes, renderWindowsShitEol} from './monaco-utils';
import {ThemeService} from '../../services/theme.service';
import {SelectButton} from 'primeng/selectbutton';
import IStandaloneDiffEditor = editor.IStandaloneDiffEditor;
import IEditorOptions = editor.IEditorOptions;
import IDiffEditorOptions = editor.IDiffEditorOptions;
import {fileName} from '../../utils/utils';
import {Button} from 'primeng/button';

interface DiffModel {
  code: string;
  fileName: string;
}

interface DiffModels {
  before: DiffModel,
  after: DiffModel
}

@Component({
  standalone: true,
  selector: 'gitgud-monaco-editor-view',
  imports: [FormsModule, SelectButton, Button],
  templateUrl: './monaco-editor-view.component.html',
  styleUrl: './monaco-editor-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonacoEditorViewComponent implements AfterViewInit, OnDestroy {

  protected currentRepo = inject(CurrentRepoStore);
  protected fileDiffPanel = inject(FileDiffPanelService);
  private fileDiff = inject(FileDiffService);
  private hunkActions = inject(MonacoDiffRightClickActionsService);
  private theme = inject(ThemeService);
  protected viewOptions = Object.entries({
    hunk:   {label: 'Hunk',   icon: 'fa fa-list'},
    inline: {label: 'Inline', icon: 'fa fa-align-left'},
    split:  {label: 'Split',  icon: 'fa fa-columns'},
  } satisfies Record<ViewType, {label: string; icon: string}>).map(([value, {label, icon}]) => ({value, label, icon}));

  fileToDiff = input<FileChange | null>();
  @ViewChild('diffEditor', {static: false}) diffEditorContainer?: ElementRef<HTMLDivElement>;
  diffModels = signal<DiffModels | undefined>(undefined);

  protected viewType = computed(() => this.currentRepo.editorConfig()!.viewType);

  private diffEditor = signal<{ editor: IStandaloneDiffEditor, contextMenuUpdater: (f: WorkingDirectoryFileChange) => void } | undefined>(undefined);
  private currentFile = signal<WorkingDirectoryFileChange | undefined>(undefined);
  private editorOptions: IDiffEditorOptions = {
    readOnly: true,
    automaticLayout: true,        // polls container size every ~100 ms; acceptable for a single editor
    ignoreTrimWhitespace: false,
    renderWhitespace: 'all',
    renderControlCharacters: true,
    unusualLineTerminators: 'off',
    diffAlgorithm: 'advanced',
    useInlineViewWhenSpaceIsLimited: true,
    cursorBlinking: 'phase',      // 'smooth' drives continuous CSS animation; 'phase' is simpler
    cursorSmoothCaretAnimation: 'off',
    definitionLinkOpensInPeek: false,
    inlineSuggest: {enabled: false},
    smoothScrolling: false,       // eliminates multi-frame scroll deceleration paint
    snippetSuggestions: 'none',
    inlayHints: {enabled: 'off'},
    parameterHints: {enabled: false},
    hover: {enabled: false},
    renderLineHighlight: 'gutter', // 'all' repaints the full-width highlight line on cursor move
    folding: false,               // fold-range computation scans visible lines on every model change
    links: false,                 // URL tokenization runs over every visible line continuously
    fontLigatures: false,         // ligature shaping adds per-character GPU cost
  };
  private lastRevealedPath: string | undefined;

  constructor() {
    registerMonacoEditorThemes();
    effect(() => editor.setTheme(this.theme.tokens().monacoTheme));

    effect((onCleanup) => {
      const file = this.fileToDiff();
      if (!file) return;

      const before$ = isCommittedFileChange(file)
        ? this.fileDiff.getFileAtRevision(file.path, `${file.commitish}^`)
        : ((file as WorkingDirectoryFileChange).staged
          ? this.fileDiff.getFileAtRevision(file.path)        // staged: HEAD vs index
          : this.fileDiff.getFileAtRevision(file.path, ''));  // unstaged: index vs workdir

      const after$ = isWorkingDirectoryFileChange(file)
        ? (file.staged
          ? this.fileDiff.getFileAtRevision(file.path, '')   // git show :path  (index)
          : from(window.tauri.fs.readFile(window.tauri.path.resolve(this.currentRepo.cwd()!, file.path))))
        : this.fileDiff.getFileAtRevision(file.path, (file as CommittedFileChange).commitish);

      const sub = combineLatest([before$, after$]).subscribe(([before, after]) => {
        this.currentFile.set(isWorkingDirectoryFileChange(file) ? file : undefined);

        this.diffModels.set({
          before: {code: renderWindowsShitEol(before), fileName: file.path},
          after: {code: renderWindowsShitEol(after), fileName: file.path},
        });
      });
      onCleanup(() => sub.unsubscribe());
    });

    effect(() => {
      const file = this.currentFile();
      const diffEditor = this.diffEditor();
      if (diffEditor && file) diffEditor.contextMenuUpdater(file);
    });

    effect(() => {
      const viewType = this.viewType();
      const diffEditor = this.diffEditor();

      if (diffEditor) {
        diffEditor.editor.updateOptions({
          renderSideBySide: viewType === 'split',
          hideUnchangedRegions: viewType === 'hunk'
            ? {enabled: true, revealLineCount: 15, minimumLineCount: 5, contextLineCount: 3}
            : {enabled: false},
        } as IEditorOptions);
      }
    });

    // Update editor models when data changes
    effect(() => {
      const models = this.diffModels();
      if (models && this.diffEditor())
        this.updateDiffEditor(models!);
    });
  }

  ngAfterViewInit(): void {
    if (this.diffEditorContainer) {
      const diffEditorEditor = editor.createDiffEditor(this.diffEditorContainer.nativeElement, this.editorOptions);
      this.diffEditor.set({editor: diffEditorEditor, contextMenuUpdater: this.hunkActions.registerEditorRightClick(diffEditorEditor)});
      diffEditorEditor.onDidUpdateDiff(this.clearEditorWhenNoChangesToDisplay(diffEditorEditor));
      // Expose for e2e tests (window.monaco is not available in the main thread)
      (window as any).__e2eDiffEditor = diffEditorEditor;
    }
  }


  ngOnDestroy(): void {
    const model = this.diffEditor()?.editor.getModel();
    model?.original.dispose();
    model?.modified.dispose();
    this.diffEditor()?.editor.dispose();
  }

  @HostListener('document:keydown.escape')
  protected onEscape = () => this.fileDiffPanel.closeDiffView();

  protected setViewType = (viewType: ViewType) => this.currentRepo.update({editorConfig: {viewType}});

  private clearEditorWhenNoChangesToDisplay = (diffEditorEditor: IStandaloneDiffEditor) => () => {
    const changes = diffEditorEditor.getLineChanges();
    if (this.currentFile() && changes !== null && changes.length === 0) {
      const oldModel = diffEditorEditor.getModel();
      diffEditorEditor.setModel(null);
      oldModel?.original.dispose();
      oldModel?.modified.dispose();
      this.fileDiffPanel.closeDiffView();
    }
  };

  private updateDiffEditor({before, after}: DiffModels) {
    const beforeUri = Uri.parse(`before-${before.fileName}`);
    const afterUri  = Uri.parse(`after-${after.fileName}`);

    const diffEditor = this.diffEditor()!.editor;
    const oldModel = diffEditor.getModel();

    const original = editor.createModel(before.code, undefined, beforeUri);
    const modified = editor.createModel(after.code,  undefined, afterUri);

    diffEditor.setModel({original, modified});

    oldModel?.original.dispose();
    oldModel?.modified.dispose();

    // Scroll editor to first edited lines on first show
    if (after.fileName !== this.lastRevealedPath) {
      this.lastRevealedPath = after.fileName;
      const disposable = diffEditor.onDidUpdateDiff(() => {
        disposable.dispose();
        const firstChange = diffEditor.getLineChanges()?.[0];
        if (firstChange) diffEditor.getModifiedEditor().revealLineInCenter(firstChange.modifiedStartLineNumber);
      });
    }
  }

  protected readonly fileName = fileName;
}
