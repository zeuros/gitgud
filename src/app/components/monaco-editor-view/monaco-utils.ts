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

import {css, editor, html, json, typescript} from 'monaco-editor';
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
      'diffEditor.insertedTextBackground': '#2a6a3a60',
      'diffEditor.removedTextBackground':  '#6a2a2a60',
      'diffEditor.insertedLineBackground': '#2a6a3a38',
      'diffEditor.removedLineBackground':  '#6a2a2a38',
    },
  });
});

// The diff view is read-only: language services (diagnostics, colors, symbols, completions…)
// only cost worker startups (the TS worker alone is 6.8 MB) and main-thread decoration work.
// Syntax highlighting comes from Monarch tokenizers on the main thread and is unaffected.
export const disableMonacoLanguageServices = once(() => {
  const off = {
    completionItems: false, hovers: false, documentSymbols: false, definitions: false, references: false,
    documentHighlights: false, rename: false, colors: false, foldingRanges: false, diagnostics: false,
    selectionRanges: false, documentFormattingEdits: false, documentRangeFormattingEdits: false, links: false,
    signatureHelp: false, onTypeFormattingEdits: false, codeActions: false, inlayHints: false,
  };

  for (const defaults of [typescript.typescriptDefaults, typescript.javascriptDefaults]) {
    defaults.setModeConfiguration(off);
    defaults.setDiagnosticsOptions({noSemanticValidation: true, noSyntaxValidation: true, noSuggestionDiagnostics: true});
  }
  for (const defaults of [css.cssDefaults, css.scssDefaults, css.lessDefaults]) defaults.setModeConfiguration(off);
  for (const defaults of [html.htmlDefaults, html.handlebarDefaults, html.razorDefaults]) defaults.setModeConfiguration(off);
  // JSON colouring comes from this language service's own main-thread tokenizer
  json.jsonDefaults.setModeConfiguration({...off, tokens: true});
});

// Monaco consumes \r in \r\n as a line separator so it never reaches renderControlCharacters.
// Replaced \r with ␍ (U+240D SYMBOL FOR CARRIAGE RETURN) so it survives as visible line content.
export const renderWindowsShitEol = (s: string) => s.replace(/\r\n/g, '␍\n');

// Undo the renderWindowsShitEol display transform: ␍ (U+240D) was substituted for \r before
// feeding content to Monaco so it would render as visible content. Patch bytes must
// contain the real \r, not the Unicode symbol.
export const realLine = (model: ITextModel, i: number) => model.getLineContent(i).replace(/␍/g, '\r');
const imageMimeTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
};

/** Mime type of a raster image path, undefined otherwise (svg stays a text diff) */
export const imageMimeType = (path: string) => imageMimeTypes[path.split('.').pop()?.toLowerCase() ?? ''];

/** Past this size (5MB text, 50MB image), the file isn't loaded at all */
export const maxDisplaySize = (path: string) => (imageMimeType(path) ? 50 : 5) * 1024 * 1024;

/** Same heuristic as git: a NUL in the first 8000 characters means binary */
export const isBinaryContent = (text: string) => text.slice(0, 8000).includes('\0');
