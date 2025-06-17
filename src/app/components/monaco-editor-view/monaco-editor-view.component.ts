import {Component, effect, ElementRef, inject, input, signal, ViewChild} from '@angular/core';
import {DiffEditorComponent, DiffEditorModel} from 'ngx-monaco-editor-v2';
import {CommittedFileChange} from '../../lib/github-desktop/model/status';
import {GitRepositoryService} from '../../services/git-repository.service';
import {filter, map, ReplaySubject, switchMap, tap} from 'rxjs';
import {editor} from 'monaco-editor';
import {NgIf} from '@angular/common';
import {FileDiffService} from '../../services/file-diff.service';
import {toObservable} from '@angular/core/rxjs-interop';
import {notUndefined} from '../../utils/utils';
import {Button} from 'primeng/button';
import {ButtonGroup} from 'primeng/buttongroup';
import {IDiff} from '../../lib/github-desktop/model/diff/diff-data';
import {Tooltip} from 'primeng/tooltip';
import {Toolbar} from 'primeng/toolbar';
import {buildDiff} from '../../lib/github-desktop/diff/diff-builder';
import {FormsModule} from '@angular/forms';
import IEditor = editor.IEditor;
import IEditorOptions = editor.IEditorOptions;
import IDiffEditor = editor.IDiffEditor;

// TODO: move
export type ViewType = 'hunk' | 'inline' | 'split';

export class Range {
  constructor(
    public startLineNumber = 1,
    public startColumn = 1,
    public endLineNumber = 1,
    public endColumn = 1,
  ) {
  }
}

@Component({
  standalone: true,
  selector: 'gitgud-monaco-editor-view',
  imports: [
    DiffEditorComponent,
    NgIf,
    Button,
    ButtonGroup,
    Tooltip,
    Toolbar,
    FormsModule,

  ],
  templateUrl: './monaco-editor-view.component.html',
  styleUrl: './monaco-editor-view.component.scss',
})
export class MonacoEditorViewComponent {

  committedFileClicked = input<CommittedFileChange>();
  editorInitOptions = {
    theme: 'vs-dark',
    readOnly: true,
    standalone: true,
    automaticLayout: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    definitionLinkOpensInPeek: false,
    experimental: {
      useTrueInlineView: true,
    },
    experimentalInlineEdit: {
      showToolbar: 'always',
    },
    inlineSuggest: {
      enabled: false,
    },
    smoothScrolling: true,
    snippetSuggestions: 'none',
    inlayHints: {
      enabled: 'off',
    },
    parameterHints: {
      enabled: false,
    },
    hover: {
      enabled: false,
    },
  } as IEditorOptions;
  diffText?: string;
  before?: DiffEditorModel;
  after?: DiffEditorModel;
  private gitRepositoryService = inject(GitRepositoryService);
  viewType = signal<ViewType>(this.gitRepositoryService.currentRepository?.editorConfig?.viewType ?? 'split');
  private fileDiffService = inject(FileDiffService);
  private editor$ = new ReplaySubject<IEditor>(1);

  @ViewChild('monacoEditor', {static: false}) monacoEditor?: ElementRef<DiffEditorComponent>;

  constructor() {
    toObservable(this.committedFileClicked)
      .pipe(
        // If file is changed, refreshing model crashes any existing editor, better reset them first ...
        tap(() => this.before = this.after = undefined),
        filter(notUndefined),
        switchMap(file => this.fileDiffService.getCommitDiff(file, file.commitish)
          .pipe(map(r => this.editorContents(buildDiff(r, file, file.commitish))))),
      )
      .subscribe(textDiff => {
        // this.hunks = {
        //   value: textDiff.hunks.join(),
        //   language: 'javascript',
        // };
        this.diffText = textDiff.text;
        this.before = this.toModel(textDiff.beforeAfter.before);
        this.after = this.toModel(textDiff.beforeAfter.after);
      });

    // Synchronizes view type with settings (TODO: can be more simple ?)
    effect(() => {
      this.gitRepositoryService.updateCurrentRepository({
        editorConfig: {
          ...this.gitRepositoryService.currentRepository?.editorConfig,
          viewType: this.viewType(),
        },
      });

      this.editor$.subscribe(e => e.updateOptions({
        renderSideBySide: this.viewType() == 'split',
        hideUnchangedRegions: this.viewType() == 'hunk' ? {enabled: true, revealLineCount: 15, minimumLineCount: 5, contextLineCount: 15} : {enabled: false},
      } as IEditorOptions));
    });
  }

  toModel = (code: string): DiffEditorModel => ({code, language: 'typescript'});

  protected onMonacoDiffEditorInit = (editor: IDiffEditor) => {
    this.editor$.next(editor);

    this.addActionButtons(editor);
    let line = editor.getPosition();
    console.log(line);
  };

  private editorContents(diffs: IDiff) {
    if ('beforeAfter' in diffs) return diffs; // ITextDiff | ILargeTextDiff

    throw new Error('This type of diff cannot be displayed yet');
  }

  addActionButtons(editor: IDiffEditor): void {
    const decorations = this.diffText!
      .split('\n')
      .map((line, index) => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          return {
            range: new Range(index + 1, 1, index + 1, line.length + 1),
            options: {
              isWholeLine: true,
              className: 'added-line',
              inlineClassName: 'added-line-inline',
              marginClassName: 'added-line-margin',
            },
          };
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          return {
            range: new Range(index + 1, 1, index + 1, line.length + 1),
            options: {
              isWholeLine: true,
              className: 'deleted-line',
              inlineClassName: 'deleted-line-inline',
              marginClassName: 'deleted-line-margin',
            },
          };
        }
      })
      .filter(notUndefined);

    editor.createDecorationsCollection(decorations);
  }
}
