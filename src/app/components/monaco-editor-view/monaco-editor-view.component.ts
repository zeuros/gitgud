import {Component, effect, inject, input, signal} from '@angular/core';
import {DiffEditorComponent, DiffEditorModel} from 'ngx-monaco-editor-v2';
import {CommittedFileChange} from '../../lib/github-desktop/model/status';
import {GitRepositoryService} from '../../services/git-repository.service';
import {filter, map, switchMap, tap} from 'rxjs';
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
  editorOptions = {
    theme: 'vs-dark',
    renderSideBySide: true,
    readOnly: true,
    standalone: true,
  };
  before?: DiffEditorModel;
  after?: DiffEditorModel;
  private gitRepositoryService = inject(GitRepositoryService);
  viewType = signal(this.gitRepositoryService.currentRepository?.editorConfig?.viewType ?? 'split');
  private fileDiffService = inject(FileDiffService);

  constructor() {
    toObservable(this.committedFileClicked)
      .pipe(
        // If file is changed, refreshing model crashes any existing editor, better reset them first ...
        tap(() => this.before = this.after = undefined),
        filter(notUndefined),
        switchMap(file => this.fileDiffService.getCommitDiff(file, file.commitish)
          .pipe(map(r => this.editorContents(buildDiff(r, file, file.commitish))))),
      )
      .subscribe(({before, after}) => {
        this.before = this.toModel(before);
        this.after = this.toModel(after);
      });

    // Synchronizes view type with settings (TODO: can be more simple ?)
    effect(() => this.gitRepositoryService.updateCurrentRepository({
      editorConfig: {
        ...this.gitRepositoryService.currentRepository?.editorConfig,
        viewType: this.viewType(),
      },
    }));
  }

  toModel = (code: string): DiffEditorModel => ({code, language: 'typescript'});

  protected onMonacoDiffEditorInit = (editor: IEditor) => {
    let line = editor.getPosition();
    console.log(line);
  };

  private editorContents(diffs: IDiff) {
    if ('beforeAfter' in diffs) return diffs.beforeAfter; // ITextDiff | ILargeTextDiff

    throw new Error('This type of diff cannot be displayed yet');
  }
}
