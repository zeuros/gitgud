import {once} from 'lodash';
import * as monacoEditor from 'monaco-editor';

export type Monaco = typeof monacoEditor;

// /!\ Use this only after the first monaco editor is loaded (in ngx-monaco-diff-editor's (oninit) callback for example)
export const monaco = once(() => (window as any).monaco as Monaco);