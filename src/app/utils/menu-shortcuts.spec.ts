import {describe, expect, it, vi} from 'vitest';
import {runMenuShortcut, shortcutMatches, type ShortcutMenuItem, withMnemonics} from './menu-shortcuts';

vi.stubGlobal('window', {tauri: {process: {platform: 'linux'}}});

const key = (eventKey: string, modifiers: Partial<KeyboardEvent> = {}) =>
  ({key: eventKey, code: '', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, preventDefault: vi.fn(), ...modifiers}) as unknown as KeyboardEvent;

describe('withMnemonics', () => {
  it('takes the words\' first letters before the others, skipping the letters already taken', () => {
    const items = withMnemonics([
      {label: 'Checkout this commit'},
      {label: 'Create branch here'},
      {label: 'Cherry pick commit'},
      {label: 'Copy commit sha'},
    ]);
    expect(items.map(item => item.mnemonic)).toEqual(['c', 'b', 'p', 's']);
    expect(items[1].labelParts).toEqual(['Create ', 'b', 'ranch here']);
  });

  it('falls back on the other letters once the first ones are taken', () => {
    const items = withMnemonics([{label: 'Move up'}, {label: 'Move'}]);
    expect(items[1].mnemonic).toBe('o');
    expect(items[1].labelParts).toEqual(['M', 'o', 've']);
  });

  it('reserves an item\'s own mnemonic and single-key shortcut before picking the others\'', () => {
    const items = withMnemonics([{label: 'Tidy'}, {label: 'Create tag here', shortcut: 'T'}, {label: 'Copy hash', shortcut: 'Ctrl+C'}, {label: 'Drop', mnemonic: 'p'}]);
    expect(items.map(item => item.mnemonic)).toEqual(['i', 't', 'c', 'p']);
    expect(items[1].labelParts).toEqual(['Create ', 't', 'ag here']);
  });

  it('leaves out separators, hidden and disabled items, and gives submenus their own letters', () => {
    const items = withMnemonics([
      {label: 'Soft', visible: false},
      {separator: true},
      {label: 'Header', disabled: true},
      {label: 'Reset', items: [{label: 'Soft'}, {label: 'Hard'}]},
    ]);
    expect(items.map(item => item.mnemonic)).toEqual([undefined, undefined, undefined, 'r']);
    expect(items[3].items!.map(item => item.mnemonic)).toEqual(['s', 'h']);
  });
});

describe('shortcutMatches', () => {
  it('matches the typed letter and the exact modifiers', () => {
    expect(shortcutMatches('B', key('b'))).toBe(true);
    expect(shortcutMatches('B', key('B', {shiftKey: true}))).toBe(false);
    expect(shortcutMatches('Ctrl+Shift+P', key('P', {ctrlKey: true, shiftKey: true}))).toBe(true);
    expect(shortcutMatches('Ctrl+P', key('p', {ctrlKey: true, shiftKey: true}))).toBe(false);
    expect(shortcutMatches('Shift+F10', key('F10', {shiftKey: true}))).toBe(true);
    expect(shortcutMatches('Ctrl+,', key(',', {ctrlKey: true}))).toBe(true);
  });
});

describe('runMenuShortcut', () => {
  it('runs the shown and enabled item having the shortcut, submenus included', () => {
    const hidden = vi.fn();
    const nested = vi.fn();
    const items: ShortcutMenuItem[] = [
      {label: 'Hidden', shortcut: 'S', visible: false, command: hidden},
      {label: 'Group', items: [{label: 'Squash', shortcut: 'S', command: nested}]},
    ];
    expect(runMenuShortcut(items, key('s'))).toBe(true);
    expect(hidden).not.toHaveBeenCalled();
    expect(nested).toHaveBeenCalledOnce();
    expect(runMenuShortcut(items, key('x'))).toBe(false);
  });
});
