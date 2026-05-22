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

import {editor} from 'monaco-editor';
import {once} from 'lodash-es';
import ITextModel = editor.ITextModel;

export const registerMonacoEditorThemes = once(() => {

  editor.defineTheme('gitgud-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background':                 '#f8f6fc',
      'editor.lineHighlightBackground':    '#eee9f5',
      'editorLineNumber.foreground':       '#b8a8c8',
      'editorLineNumber.activeForeground': '#8e4e8c',
      'diffEditor.insertedTextBackground': '#c8f0d040',
      'diffEditor.removedTextBackground':  '#f8d0d040',
      'diffEditor.insertedLineBackground': '#d4f0da30',
      'diffEditor.removedLineBackground':  '#f8dada30',
    },
  });

  editor.defineTheme('gitgud-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background':                 '#1c1e23',
      'editor.lineHighlightBackground':    '#2c2d37',
      'editorLineNumber.foreground':       '#585e6e',
      'editorLineNumber.activeForeground': '#ce93d8',
      'diffEditor.insertedTextBackground': '#1e402840',
      'diffEditor.removedTextBackground':  '#40201e40',
      'diffEditor.insertedLineBackground': '#1e402820',
      'diffEditor.removedLineBackground':  '#40201e20',
    },
  });
});


// Monaco consumes \r in \r\n as a line separator so it never reaches renderControlCharacters.
// Replaced \r with ␍ (U+240D SYMBOL FOR CARRIAGE RETURN) so it survives as visible line content.
export const renderWindowsShitEol = (s: string) => s.replace(/\r\n/g, '␍\n');

// Undo the renderWindowsShitEol display transform: ␍ (U+240D) was substituted for \r before
// feeding content to Monaco so it would render as visible content. Patch bytes must
// contain the real \r, not the Unicode symbol.
export const realLine = (model: ITextModel, i: number) => model.getLineContent(i).replace(/␍/g, '\r');