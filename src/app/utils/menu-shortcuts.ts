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

import type {MenuItem} from 'primeng/api';

export interface ShortcutMenuItem extends MenuItem {
  // The letter typed in the open menu to run the item, picked from its label when not given
  mnemonic?: string;
  // The key combination running the item without opening the menu, as `shortcutMatches` reads it ('B', 'Ctrl+Shift+P')
  shortcut?: string;
  // The label split around its underlined mnemonic
  labelParts?: [string, string, string];
  items?: ShortcutMenuItem[];
}

const isMnemonicCharacter = (character: string) => /[\p{L}\p{N}]/u.test(character);

const isShown = (item: MenuItem) => item.visible !== false && !item.separator && !item.disabled && !!item.label;

// The label's letters in the order they are tried: the words' first letters, then the others
const mnemonicCandidates = (label: string) => {
  const characters = [...label];
  const indexes = characters.map((_, index) => index).filter(index => isMnemonicCharacter(characters[index]));
  const startsWord = (index: number) => index == 0 || !isMnemonicCharacter(characters[index - 1]);
  return [...indexes.filter(startsWord), ...indexes.filter(index => !startsWord(index))]
    .map(index => ({index, mnemonic: characters[index].toLowerCase()}));
};

const splitLabel = (label: string, index: number): [string, string, string] => {
  const characters = [...label];
  return [characters.slice(0, index).join(''), characters[index], characters.slice(index + 1).join('')];
};

const singleKeyShortcut = (item: ShortcutMenuItem) =>
  item.shortcut && [...item.shortcut].length == 1 ? item.shortcut.toLowerCase() : undefined;

/**
 * Gives each item of the menu and its submenus a distinct mnemonic: the item's own, else its single-key shortcut, else
 * the first of its label's letters not taken by an item above, words' first letters first.
 */
export const withMnemonics = (items: ShortcutMenuItem[]): ShortcutMenuItem[] => {
  const wanted = items.map(item => isShown(item) ? item.mnemonic?.toLowerCase() ?? singleKeyShortcut(item) : undefined);
  const taken = new Set(wanted.filter(mnemonic => mnemonic !== undefined));

  return items.map((item, position) => {
    const submenu = item.items && {items: withMnemonics(item.items)};
    if (!isShown(item)) return {...item, ...submenu};

    const candidates = mnemonicCandidates(item.label!);
    const chosenMnemonic = wanted[position];
    const chosen = chosenMnemonic
      ? candidates.find(candidate => candidate.mnemonic == chosenMnemonic) ?? {index: -1, mnemonic: chosenMnemonic}
      : candidates.find(candidate => !taken.has(candidate.mnemonic));
    if (!chosen) return {...item, ...submenu};

    taken.add(chosen.mnemonic);
    const labelParts = chosen.index >= 0 ? splitLabel(item.label!, chosen.index) : undefined;
    return {...item, ...submenu, mnemonic: chosen.mnemonic, labelParts};
  });
};

const isMac = () => window.tauri?.process.platform == 'darwin';

// 'Ctrl+Shift+P' as typed on this platform: Ctrl is Cmd on macOS
export const shortcutLabel = (shortcut: string) => isMac() ? shortcut.replace('Ctrl+', '⌘').replace('Shift+', '⇧').replace('Alt+', '⌥') : shortcut;

/**
 * Whether the event types `shortcut`, modifiers then the key joined with '+' ('Ctrl+Shift+P', 'B', 'F2', 'Delete'). A
 * letter is the one typed rather than its key's position (Ctrl+Z is on Ctrl+W's key on AZERTY). Ctrl stands for Cmd on
 * macOS.
 */
export const shortcutMatches = (shortcut: string, event: KeyboardEvent) => {
  const parts = shortcut.split('+');
  const key = parts.pop()!;
  const modifiers = new Set(parts);
  const ctrlPressed = isMac() ? event.metaKey : event.ctrlKey;
  const keyMatches = key.length == 1
    ? event.key.toLowerCase() == key.toLowerCase()
    : event.key == key || event.code == key;
  return keyMatches
    && ctrlPressed == modifiers.has('Ctrl')
    && event.shiftKey == modifiers.has('Shift')
    && event.altKey == modifiers.has('Alt');
};

// Runs the menu's item having the shortcut the event types, when shown and enabled. Returns whether one ran
export const runMenuShortcut = (items: ShortcutMenuItem[], event: KeyboardEvent): boolean => {
  for (const item of items) {
    if (item.visible === false || item.disabled) continue;
    if (item.shortcut && item.command && shortcutMatches(item.shortcut, event)) {
      event.preventDefault();
      item.command({originalEvent: event, item});
      return true;
    }
    if (item.items && runMenuShortcut(item.items, event)) return true;
  }
  return false;
};

// Typing in these keeps its keys: shortcuts without Ctrl or Alt would eat its letters
export const isTextInput = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.matches('input, textarea, select, [contenteditable]') || !!target.closest('.monaco-editor'));
