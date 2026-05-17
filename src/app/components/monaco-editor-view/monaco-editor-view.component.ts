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

import {type AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, HostListener, inject, input, NgZone, type OnDestroy, signal, ViewChild} from '@angular/core';
import {CommittedFileChange, FileChange, isCommittedFileChange, isWorkingDirectoryFileChange} from '../../lib/github-desktop/model/status';
import {editor, Uri} from 'monaco-editor';
import {FileDiffService} from '../../services/file-diff.service';
import {FormsModule} from '@angular/forms';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {WorkingDirectoryFileChange} from '../../lib/github-desktop/model/workdir';
import {combineLatest, of} from 'rxjs';
import {MonacoDiffRightClickActionsService} from './monaco-diff-right-click-actions.service';
import {FileDiffPanelService} from '../../services/file-diff-panel.service';
import {type ViewType} from '../../models/git-repository';
import {renderWindowsShitEol} from './monaco-utils';
import {SelectButton} from 'primeng/selectbutton';
import ITextModel = editor.ITextModel;
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
  private ngZone = inject(NgZone);

  protected viewOptions = Object.entries({
    hunk:   {label: 'Hunk',   icon: 'fa fa-list'},
    inline: {label: 'Inline', icon: 'fa fa-align-left'},
    split:  {label: 'Split',  icon: 'fa fa-columns'},
  } satisfies Record<ViewType, {label: string; icon: string}>).map(([value, {label, icon}]) => ({value, label, icon}));

  fileToDiff = input<FileChange>();
  @ViewChild('diffEditor', {static: false}) diffEditorContainer?: ElementRef<HTMLDivElement>;
  diffModels = signal<DiffModels | undefined>(undefined);

  protected viewType = computed(() => this.currentRepo.editorConfig()!.viewType);

  private diffEditor = signal<{ editor: IStandaloneDiffEditor, contextMenuUpdater: (f: WorkingDirectoryFileChange) => void } | undefined>(undefined);
  private ownedModels = new Set<ITextModel>(); // Models are cached for the component's lifetime — switching between already-viewed files hits the URI cache
  private currentFile = signal<WorkingDirectoryFileChange | undefined>(undefined);
  private editorOptions: IDiffEditorOptions = {
    readOnly: true,
    automaticLayout: true,
    ignoreTrimWhitespace: false,
    renderWhitespace: 'all',
    renderControlCharacters: true,
    unusualLineTerminators: 'off',
    diffAlgorithm: 'advanced',
    useInlineViewWhenSpaceIsLimited: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    definitionLinkOpensInPeek: false,
    inlineSuggest: {enabled: false},
    smoothScrolling: true,
    snippetSuggestions: 'none',
    inlayHints: {enabled: 'off'},
    parameterHints: {enabled: false},
    hover: {enabled: false},
    renderLineHighlight: 'all',
  };
  private lastRevealedPath: string | undefined;

  constructor() {
    effect(() => {
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
          : of(window.electron.fs.readFileSync(window.electron.path.resolve(this.currentRepo.cwd()!, file.path))))
        : this.fileDiff.getFileAtRevision(file.path, (file as CommittedFileChange).commitish);

      combineLatest([before$, after$]).subscribe(([before, after]) => {
        this.currentFile.set(isWorkingDirectoryFileChange(file) ? file : undefined);

        this.diffModels.set({
          before: {code: renderWindowsShitEol(before), fileName: file.path},
          after: {code: renderWindowsShitEol(after), fileName: file.path},
        });
      });
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
        this.ngZone.runOutsideAngular(() => diffEditor.editor.updateOptions({
          renderSideBySide: viewType === 'split',
          hideUnchangedRegions: viewType === 'hunk'
            ? {enabled: true, revealLineCount: 15, minimumLineCount: 5, contextLineCount: 3}
            : {enabled: false},
        } as IEditorOptions));
      }
    });

    // Update editor models when data changes
    effect(() => {
      const models = this.diffModels();
      if (models && this.diffEditor())
        this.ngZone.runOutsideAngular(() => this.updateDiffEditor(models!));
    });
  }

  ngAfterViewInit(): void {
    if (this.diffEditorContainer) {
      this.ngZone.runOutsideAngular(() => {
        const diffEditorEditor = editor.createDiffEditor(this.diffEditorContainer!.nativeElement, this.editorOptions);
        this.diffEditor.set({editor: diffEditorEditor, contextMenuUpdater: this.hunkActions.registerEditorRightClick(diffEditorEditor)});
        diffEditorEditor.onDidUpdateDiff(this.clearEditorWhenNoChangesToDisplay(diffEditorEditor));
      });
    }
  }


  ngOnDestroy(): void {
    this.diffEditor()?.editor.dispose();
    this.ownedModels.forEach(m => m.dispose());
    this.ownedModels.clear();
  }

  @HostListener('document:keydown.escape')
  protected onEscape = () => this.fileDiffPanel.closeDiffView();

  protected setViewType = (viewType: ViewType) => this.currentRepo.update({editorConfig: {viewType}});

  private clearEditorWhenNoChangesToDisplay = (diffEditorEditor: IStandaloneDiffEditor) => () => {
    const changes = diffEditorEditor.getLineChanges();
    if (this.currentFile() && changes !== null && changes.length === 0) {
      this.diffEditor()?.editor.dispose();
      this.ngZone.run(() => this.fileDiffPanel.closeDiffView());
    }
  };

  private updateDiffEditor({before, after}: DiffModels) {
    const beforeUri = Uri.parse(`before-${before.fileName}`);
    const afterUri = Uri.parse(`after-${after.fileName}`);

    let original = editor.getModel(beforeUri);
    let modified = editor.getModel(afterUri);

    if (original) {
      original.setValue(before.code);
    } else {
      original = editor.createModel(before.code, undefined, beforeUri);
      this.ownedModels.add(original);
    }

    if (modified) {
      modified.setValue(after.code);
    } else {
      modified = editor.createModel(after.code, undefined, afterUri);
      this.ownedModels.add(modified);
    }

    const diffEditor = this.diffEditor()!.editor;
    diffEditor.setModel({original, modified});

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
