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
import ITextModel = editor.ITextModel;

// Monaco consumes \r in \r\n as a line separator so it never reaches renderControlCharacters.
// Replaced \r with ␍ (U+240D SYMBOL FOR CARRIAGE RETURN) so it survives as visible line content.
export const renderWindowsShitEol = (s: string) => s.replace(/\r\n/g, '␍\n');

// Undo the renderWindowsShitEol display transform: ␍ (U+240D) was substituted for \r before
// feeding content to Monaco so it would render as visible content. Patch bytes must
// contain the real \r, not the Unicode symbol.
export const realLine = (model: ITextModel, i: number) => model.getLineContent(i).replace(/␍/g, '\r');