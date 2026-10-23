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

// Multiple row selection, as file managers do: click selects a row, ctrl+click toggles one, shift+click selects
// from the anchor (the last row clicked without shift) to the clicked row. Rows are identified by key, in row order.

export interface RowSelection {
  keys: string[]; // Selected keys, in the order they were selected
  anchor?: number; // Row index shift ranges start from
  rangeEnd?: number; // Other end of the last shift range, replaced by the next shift+click
}

export interface SelectModifiers {
  ctrl?: boolean;
  shift?: boolean;
}

const rangeKeys = (keys: string[], a: number, b: number) => keys.slice(Math.min(a, b), Math.max(a, b) + 1);

export const selectRow = (rowKeys: string[], {keys, anchor, rangeEnd}: RowSelection, index: number, {ctrl, shift}: SelectModifiers = {}): RowSelection => {
  const key = rowKeys[index];
  if (key === undefined) return {keys, anchor, rangeEnd};

  if (shift && anchor !== undefined) {
    // The previous range gives way to the new one; rows toggled with ctrl stay selected
    const previousRange = new Set(rangeKeys(rowKeys, anchor, rangeEnd ?? anchor));
    const kept = keys.filter(k => !previousRange.has(k));
    const range = rangeKeys(rowKeys, anchor, index).filter(k => !kept.includes(k));
    return {keys: [...kept, ...range], anchor, rangeEnd: index};
  }

  if (ctrl) {
    return {keys: keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key], anchor: index, rangeEnd: index};
  }

  return {keys: [key], anchor: index, rangeEnd: index};
};

// Keyboard: up / down move from the last moved end of the selection to the previous / next row, extending it from the
// anchor with shift
export const moveSelection = (rowKeys: string[], selection: RowSelection, delta: number, {shift}: SelectModifiers = {}): RowSelection => {
  if (!rowKeys.length) return selection;
  const from = selection.rangeEnd ?? selection.anchor ?? -1;
  const index = Math.min(rowKeys.length - 1, Math.max(0, from + delta));
  return selectRow(rowKeys, selection, index, {shift: shift && selection.anchor !== undefined});
};

export const selectAll = (rowKeys: string[]): RowSelection => ({keys: [...rowKeys], anchor: 0, rangeEnd: rowKeys.length - 1});
