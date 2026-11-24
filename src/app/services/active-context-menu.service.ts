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

import {computed, Injectable, signal} from '@angular/core';
import type {ContextMenu} from 'primeng/contextmenu';
import {isTextInput, runMenuShortcut, shortcutMatches, type ShortcutMenuItem, withMnemonics} from '../utils/menu-shortcuts';

interface ProcessedMenuItem {
  item: ShortcutMenuItem;
  index: number;
  level: number;
  key: string;
  parentKey: string;
  items: ProcessedMenuItem[];
}

// Modifiers alone and the lists' navigation keys: building the menu for them would be wasted
const NOT_SHORTCUT_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' ', 'Tab', 'Escape']);

@Injectable({providedIn: 'root'})
export class ActiveContextMenuService {
  menuRef?: ContextMenu;
  contextMenu = signal<ShortcutMenuItem[]>([]);
  // The menu as shown, its items underlining their mnemonic
  shownContextMenu = computed(() => withMnemonics(this.contextMenu()));

  constructor() {
    // Captured: runs before the menu's own key handling, which only moves the focus to an item starting with the letter
    document.addEventListener('keydown', this.runMnemonic, {capture: true});
  }

  register(menu: ContextMenu) {
    this.menuRef = menu;
  }

  show = (items: ShortcutMenuItem[], event: Event) => {
    this.contextMenu.set(items);
    this.menuRef?.show(event);
  };

  // Opens the menu below an element, for a menu opened from the keyboard
  showAt = (items: ShortcutMenuItem[], element: Element) => {
    const {left, bottom} = element.getBoundingClientRect();
    this.show(items, new MouseEvent('contextmenu', {clientX: left + 24, clientY: bottom}));
  };

  hide = () => this.menuRef?.hide();

  /**
   * Keys pressed on a focused element having a menu: the context menu key or Shift+F10 open the menu below `anchor`,
   * the items' shortcuts run them. Ctrl+C keeps copying the selected text, if any
   */
  onMenuOwnerKeydown = (event: KeyboardEvent, menu: () => ShortcutMenuItem[] | undefined, anchor: () => Element | null | undefined) => {
    if (isTextInput(event.target) || NOT_SHORTCUT_KEYS.has(event.key)) return;
    if (shortcutMatches('Ctrl+C', event) && window.getSelection()?.toString()) return;
    const items = menu();
    if (!items) return;

    if (event.key == 'ContextMenu' || shortcutMatches('Shift+F10', event)) {
      const anchorElement = anchor();
      if (!anchorElement) return;
      event.preventDefault();
      this.showAt(items, anchorElement);
    } else {
      runMenuShortcut(items, event);
    }
  };

  // The typed letter runs the item of the focused (sub)menu it underlines, or opens its submenu. Several items with the
  // same letter: it moves the focus to the next one instead
  private runMnemonic = (event: KeyboardEvent) => {
    const menu = this.menuRef;
    if (!menu?.visible() || event.ctrlKey || event.altKey || event.metaKey || [...event.key].length != 1) return;

    const key = event.key.toLowerCase();
    const matches = (menu.visibleItems as ProcessedMenuItem[])
      .filter(({item}) => item.mnemonic == key && item.visible !== false && !item.disabled);
    if (!matches.length) return;
    event.preventDefault();
    event.stopPropagation();

    const focusedIndex = menu.focusedItemInfo().index;
    const target = matches.find(({index}) => index > focusedIndex) ?? matches[0];
    const {index, level, parentKey, item} = target;
    menu.focusedItemInfo.set({index, level, parentKey, item});
    if (matches.length > 1) return;

    if (target.items.length) {
      menu.onArrowRightKey(event);
    } else {
      menu.hide();
      item.command?.({originalEvent: event, item});
    }
  };
}
