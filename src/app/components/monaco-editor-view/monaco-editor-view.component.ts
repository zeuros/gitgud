import {Component} from '@angular/core';
import {DiffEditorComponent, DiffEditorModel} from 'ngx-monaco-editor-v2';

@Component({
  standalone: true,
  selector: 'gitgud-monaco-editor-view',
  imports: [DiffEditorComponent],
  templateUrl: './monaco-editor-view.component.html',
  styleUrl: './monaco-editor-view.component.scss',
})
export class MonacoEditorViewComponent {
  options = {
    theme: 'vs-dark',
  };
  originalModel: DiffEditorModel = {
    code: 'heLLo world!',
    language: 'text/plain',
  };

  modifiedModel: DiffEditorModel = {
    code: 'hello orlando!',
    language: 'text/plain',
  };

}
