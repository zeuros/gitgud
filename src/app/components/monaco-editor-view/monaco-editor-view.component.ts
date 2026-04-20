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

import {AfterViewInit, Component, computed, effect, ElementRef, inject, input, OnDestroy, signal, untracked, ViewChild} from '@angular/core';
import {CommittedFileChange, FileChange, isCommittedFileChange, isWorkingDirectoryFileChange} from '../../lib/github-desktop/model/status';
import {editor, Uri} from 'monaco-editor';
import {FileDiffService} from '../../services/file-diff.service';
import {Button} from 'primeng/button';
import {ButtonGroup} from 'primeng/buttongroup';
import {Tooltip} from 'primeng/tooltip';
import {Toolbar} from 'primeng/toolbar';
import {FormsModule} from '@angular/forms';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {WorkingDirectoryFileChange} from '../../lib/github-desktop/model/workdir';
import {combineLatest, of} from 'rxjs';
import {GitApiService} from '../../services/electron-cmd-parser-layer/git-api.service';
import {MonacoDiffRightClickActionsService} from './monaco-diff-right-click-actions.service';
import {ViewType} from '../../models/git-repository';
import {ConflictParserService} from '../../services/conflict-parser.service';
import {ConflictResolverComponent} from '../conflict-resolver/conflict-resolver.component';
import {GitRefreshService} from '../../services/git-refresh.service';
import IEditorOptions = editor.IEditorOptions;
import ITextModel = editor.ITextModel;
import IStandaloneDiffEditor = editor.IStandaloneDiffEditor;

interface DiffModel {
  code: string;
  fileName: string;
}

// AAA
interface DiffModels {
  before: DiffModel,
  after: DiffModel
}

@Component({
  standalone: true,
  selector: 'gitgud-monaco-editor-view',
  imports: [Button, ButtonGroup, Tooltip, Toolbar, FormsModule, ConflictResolverComponent],
  templateUrl: './monaco-editor-view.component.html',
  styleUrl: './monaco-editor-view.component.scss',
})
export class MonacoEditorViewComponent implements AfterViewInit, OnDestroy {
  fileToDiff = input<FileChange>();
  @ViewChild('diffEditor', {static: false}) diffEditorContainer?: ElementRef<HTMLDivElement>;
  diffModels = signal<DiffModels | undefined>(undefined);

  protected currentRepo = inject(CurrentRepoStore);
  protected viewType = computed(() => this.currentRepo.editorConfig()!.viewType);

  protected conflictFileContent = signal<string | undefined>(undefined);
  protected conflictFilePath = signal<string | undefined>(undefined);

  private fileDiffService = inject(FileDiffService);
  private gitApi = inject(GitApiService);
  private gitRefresh = inject(GitRefreshService);
  private hunkActionsService = inject(MonacoDiffRightClickActionsService);
  private conflictParser = inject(ConflictParserService);
  private diffEditor = signal<{ editor: IStandaloneDiffEditor, contextMenuUpdater: (f: WorkingDirectoryFileChange) => void} | undefined>(undefined);
  private ownedModels = new Set<ITextModel>(); // Models are cached for the component's lifetime — switching between already-viewed files hits the URI cache
  private currentFile = signal<WorkingDirectoryFileChange | undefined>(undefined);
  private editorOptions: IEditorOptions & { theme: string } = {
    theme: 'vs-dark',
    readOnly: true,
    // standalone: true,
    automaticLayout: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    definitionLinkOpensInPeek: false,
    // experimental: {useTrueInlineView: true},
    // experimentalInlineEdit: {showToolbar: 'always'},
    inlineSuggest: {enabled: false},
    smoothScrolling: true,
    snippetSuggestions: 'none',
    inlayHints: {enabled: 'off'},
    parameterHints: {enabled: false},
    hover: {enabled: false},
    renderLineHighlight: 'all',
  };

  constructor() {
    effect(() => {
      const file = this.fileToDiff();
      if (!file) return;

      // Check for merge conflicts in unstaged working-dir files
      if (isWorkingDirectoryFileChange(file) && !file.staged) {
        const absPath = window.electron.path.resolve(this.gitApi.cwd()!, file.path);
        try {
          const content = window.electron.fs.readFileSync(absPath);
          if (ConflictParserService.hasConflicts(content)) {
            this.conflictFileContent.set(content);
            this.conflictFilePath.set(file.path);
            return;
          }
        } catch { /* file might not exist */ }
      }

      this.conflictFileContent.set(undefined);
      this.conflictFilePath.set(undefined);

      const before$ = isCommittedFileChange(file)
        ? this.fileDiffService.getFileAtRevision(file.path, `${file.commitish}^`)
        : ((file as WorkingDirectoryFileChange).staged
            ? this.fileDiffService.getFileAtRevision(file.path)
            : this.fileDiffService.getFileAtRevision(file.path, ''));

      const after$ = isWorkingDirectoryFileChange(file)
        ? (file.staged
            ? this.fileDiffService.getFileAtRevision(file.path, '')
            : of(window.electron.fs.readFileSync(window.electron.path.resolve(this.gitApi.cwd()!, file.path))))
        : this.fileDiffService.getFileAtRevision(file.path, (file as CommittedFileChange).commitish);

      combineLatest([before$, after$]).subscribe(([before, after]) => {
        this.currentFile.set(isWorkingDirectoryFileChange(file) ? file : undefined);

        this.diffModels.set({
          before: {code: before, fileName: file.path},
          after: {code: after, fileName: file.path},
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
      this.diffEditor.set({editor: diffEditorEditor, contextMenuUpdater: this.hunkActionsService.registerEditorRightClick(diffEditorEditor)});
    }
  }


  ngOnDestroy(): void {
    this.diffEditor()?.editor.dispose();
    this.ownedModels.forEach(m => m.dispose());
    this.ownedModels.clear();
  }

  protected setViewType = (viewType: ViewType) => this.currentRepo.update({editorConfig: {viewType}});

  protected onConflictResolved = () => {
    this.conflictFileContent.set(undefined);
    this.conflictFilePath.set(undefined);
    this.gitRefresh.doRefreshBranchesAndLogs();
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

    this.diffEditor()!.editor.setModel({original, modified});
  }

}
