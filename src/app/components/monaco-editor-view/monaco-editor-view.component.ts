import {Component, computed, inject, input, Signal} from '@angular/core';
import {DiffEditorComponent, DiffEditorModel, NgxEditorModel} from 'ngx-monaco-editor-v2';
import {CommittedFileChange} from '../../lib/github-desktop/model/status';
import {GitRepositoryService} from '../../services/git-repository.service';
import {Monaco} from '../../utils/editor';
import {BehaviorSubject, filter, Subject, switchMap} from 'rxjs';
import {editor} from 'monaco-editor';
import {JsonPipe, NgIf} from '@angular/common';
import {FileDiffService} from '../../services/file-diff.service';
import {toObservable, toSignal} from '@angular/core/rxjs-interop';
import {notUndefined} from '../../utils/utils';
import {Button} from 'primeng/button';
import {ButtonGroup} from 'primeng/buttongroup';
import {IDiff} from '../../lib/github-desktop/model/diff/diff-data';
import {Tooltip} from 'primeng/tooltip';
import IEditor = editor.IEditor;
import {Toolbar} from 'primeng/toolbar';


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
    JsonPipe,

  ],
  templateUrl: './monaco-editor-view.component.html',
  styleUrl: './monaco-editor-view.component.scss',
})
export class MonacoEditorViewComponent {

  gitRepositoryService = inject(GitRepositoryService);
  fileDiffService = inject(FileDiffService);
  viewType$ = new BehaviorSubject<'hunk' | 'inline' | 'split'>('hunk'); // TODO: sync with settings

  constructor() {
    this.viewType$.subscribe(viewType => {

    });
  }

  protected readonly options = {
    theme: 'vs-dark',
    renderSideBySide: true,
    readOnly: true,
  };

  committedFileClicked = input<CommittedFileChange>();

  protected readonly diffs = toSignal(toObservable(this.committedFileClicked).pipe(
    filter(notUndefined),
    switchMap(file => this.fileDiffService.getCommitDiff(file, file.commitish)),
  ));

  initialModel: Signal<DiffEditorModel> = computed(() => ({
    code: this.editorContents(this.diffs()!),
    language: 'typescript',
  }));

  modifiedModel: Signal<DiffEditorModel> = computed(() => ({
    code: 'hello orlando !',
    language: 'typescript',
  }));

  // originalModel: Signal<NgxEditorModel> = computed(() => ({
  //   value: '',
  //   uri: ((window as any).monaco as typeof monaco).Uri.parse([(this.gitRepositoryService.currentRepository?.directory ?? ''), (this.committedFileClicked() as any).path].join('\\')),
  //   language: 'typescript',
  // }));

  // protected model = computed(() => editor.createModel(
  //   this.committedFileClicked().name,
  //   undefined,
  //   Uri.file(this.committedFileClicked().name),
  protected model: Signal<NgxEditorModel> = computed(() => ({
    value: this.committedFileClicked()!.path,
    language: 'json',
    uri: this.committedFileClicked()!.path,
  }));
  private monacoEditorLoaded$ = Subject<Monaco>;

  protected onMonacoDiffEditorInit = (editor: IEditor) => {
    let line = editor.getPosition();
    console.log(line);
  };

  private editorContents(diffs: IDiff) {
    if ('text' in diffs) return diffs.text; // ITextDiff | ILargeTextDiff

    return 'This type of diff cannot be displayed yet';
  }
}
