import {Component, computed, inject, input, Signal} from '@angular/core';
import {DiffEditorComponent, DiffEditorModel, NgxEditorModel} from 'ngx-monaco-editor-v2';
import {CommittedFileChange} from '../../lib/github-desktop/model/status';
import {GitRepositoryService} from '../../services/git-repository.service';
import {Monaco} from '../../utils/editor';
import {Subject} from 'rxjs';
import {editor} from 'monaco-editor';
import IEditor = editor.IEditor;


@Component({
  standalone: true,
  selector: 'gitgud-monaco-editor-view',
  imports: [
    DiffEditorComponent,
  ],
  templateUrl: './monaco-editor-view.component.html',
  styleUrl: './monaco-editor-view.component.scss',
})
export class MonacoEditorViewComponent {

  committedFileClicked = input(CommittedFileChange);
  options = {
    theme: 'vs-dark',
  };
  initialModel: DiffEditorModel = {
    code: 'hello !',
    language: 'typescript',
  };
  modifiedModel: DiffEditorModel = {
    code: 'hello orlando!',
    language: 'typescript',
  };
  protected readonly gitRepositoryService = inject(GitRepositoryService);
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
    value: this.committedFileClicked().name,
    language: 'json',
    uri: this.committedFileClicked().name,
  }));
  private monacoEditorLoaded$ = Subject<Monaco>;

  protected onMonacoDiffEditorInit = (editor: IEditor) => {
    let line = editor.getPosition();
    editor.setModel({
      model: {
        original: {
          uri
        },
        modified: undefined,
      }
    });
    console.log(line);
  };

}
