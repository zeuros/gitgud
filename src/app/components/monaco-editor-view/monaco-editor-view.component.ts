import {AfterViewInit, Component, effect, ElementRef, inject, input, OnDestroy, signal, ViewChild} from '@angular/core';
import {CommittedFileChange, FileChange} from '../../lib/github-desktop/model/status';
import {GitRepositoryService} from '../../services/git-repository.service';
import {editor, Uri} from 'monaco-editor';
import {FileDiffService} from '../../services/file-diff.service';
import {instanceOf} from '../../utils/utils';
import {Button} from 'primeng/button';
import {ButtonGroup} from 'primeng/buttongroup';
import {IDiff} from '../../lib/github-desktop/model/diff/diff-data';
import {Tooltip} from 'primeng/tooltip';
import {Toolbar} from 'primeng/toolbar';
import {buildDiff} from '../../lib/github-desktop/diff/diff-builder';
import {FormsModule} from '@angular/forms';
import IEditorOptions = editor.IEditorOptions;
import IDiffEditor = editor.IDiffEditor;

// TODO: move
export type ViewType = 'hunk' | 'inline' | 'split';


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
  imports: [Button, ButtonGroup, Tooltip, Toolbar, FormsModule],
  templateUrl: './monaco-editor-view.component.html',
  styleUrl: './monaco-editor-view.component.scss',
})
export class MonacoEditorViewComponent implements AfterViewInit, OnDestroy {
  fileToDiff = input<FileChange>();
  @ViewChild('diffEditor', {static: false}) diffEditorContainer?: ElementRef<HTMLDivElement>;
  diffModels = signal<DiffModels | undefined>(undefined);

  private readonly gitRepositoryService = inject(GitRepositoryService);
  viewType = signal<ViewType>(this.gitRepositoryService.currentRepository?.editorConfig?.viewType ?? 'split');

  private fileDiffService = inject(FileDiffService);
  private diffEditor?: IDiffEditor;
  private readonly editorOptions: IEditorOptions & { theme: string } = {
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
  };

  constructor() {
    effect(() => {
      const file = this.fileToDiff();
      if (!file) return;

      const diff$ = instanceOf(file, CommittedFileChange)
        ? this.fileDiffService.getCommitDiff(file, file.commitish)
        : this.fileDiffService.getWorkingDirectoryDiff(file);

      diff$.subscribe(r => {
        const diff = this.editorContents(buildDiff(r, file));

        this.diffModels.set({
          before: {code: diff.beforeAfter.before, fileName: file.path},
          after: {code: diff.beforeAfter.after, fileName: file.path},
        });
      });
    });

    effect(() => {
      this.gitRepositoryService.updateCurrentRepository({
        editorConfig: {...this.gitRepositoryService.currentRepository?.editorConfig, viewType: this.viewType()},
      });

      if (this.diffEditor) {
        this.diffEditor.updateOptions({
          renderSideBySide: this.viewType() === 'split',
          hideUnchangedRegions: this.viewType() === 'hunk'
            ? {enabled: true, revealLineCount: 15, minimumLineCount: 5, contextLineCount: 3}
            : {enabled: false},
        } as IEditorOptions);
      }
    });

    // Update editor models when data changes
    effect(() => {
      if (this.diffModels() && this.diffEditor)
        this.updateDiffEditor(this.diffModels()!);
    });
  }

  ngAfterViewInit(): void {
    if (this.diffEditorContainer) {
      this.diffEditor = editor.createDiffEditor(this.diffEditorContainer.nativeElement, this.editorOptions);
    }
  }


  ngOnDestroy(): void {
    // TODO: dispose old models?
    //   Note: disposing models here causes issues when switching between files, as the models are shared/reused
    //   For now we let monaco handle the disposal when the editor is disposed; otherwise we get "Model is disposed" errors
    //   this.diffEditor?.getModel()?.original.dispose();
    //   this.diffEditor?.getModel()?.modified.dispose();
    this.diffEditor?.dispose();
  }

  private updateDiffEditor({before, after}: DiffModels) {
    const beforeUri = Uri.parse(`before-${before.fileName}`);
    const afterUri = Uri.parse(`after-${after.fileName}`);

    let original = editor.getModel(beforeUri);
    let modified = editor.getModel(afterUri);

    if (original) {
      original.setValue(before.code);
    } else {
      original = editor.createModel(before.code, undefined, beforeUri);
    }

    if (modified) {
      modified.setValue(after.code);
    } else {
      modified = editor.createModel(after.code, undefined, afterUri);
    }

    this.diffEditor!.setModel({original, modified});
  }

  private editorContents(diffs: IDiff) {
    if ('beforeAfter' in diffs) return diffs;
    throw new Error('This type of diff cannot be displayed yet');
  }
}
