import {describe, expect, it} from 'vitest';
import {rowsInView, toPathTree, treeKeyAction, visibleRows} from './tree-utils';

const tree = toPathTree(['main', 'feat/a', 'feat/b', 'fix/c'], name => name, () => ({}));
const listed = (collapsedKeys: string[]) => visibleRows(tree, new Set(collapsedKeys)).map(({node, depth}) => `${depth}:${node.key}`);

describe('visibleRows', () => {
  it('lists the nodes depth first', () =>
    expect(listed([])).toEqual(['0:main', '0:feat', '1:feat/a', '1:feat/b', '0:fix', '1:fix/c']));

  it('skips the children of a collapsed folder', () =>
    expect(listed(['feat'])).toEqual(['0:main', '0:feat', '0:fix', '1:fix/c']));
});

describe('treeKeyAction', () => {
  const action = (focusedKey: string | undefined, key: string, collapsedKeys: string[] = []) => {
    const collapsed = new Set(collapsedKeys);
    return treeKeyAction(visibleRows(tree, collapsed), focusedKey, key, 2, node => !collapsed.has(node.key!));
  };

  it('moves the focus up and down, staying within the rows', () => {
    expect(action('feat', 'ArrowDown')).toEqual({focusKey: 'feat/a'});
    expect(action('main', 'ArrowUp')).toEqual({focusKey: 'main'});
    expect(action('fix/c', 'ArrowDown')).toEqual({focusKey: 'fix/c'});
  });

  it('moves by pages and to the ends', () => {
    expect(action('main', 'PageDown')).toEqual({focusKey: 'feat/a'});
    expect(action('feat/b', 'Home')).toEqual({focusKey: 'main'});
    expect(action('main', 'End')).toEqual({focusKey: 'fix/c'});
  });

  it('skips the children of a collapsed folder', () =>
    expect(action('feat', 'ArrowDown', ['feat'])).toEqual({focusKey: 'fix'}));

  it('expands a collapsed folder, then goes to its first child', () => {
    expect(action('feat', 'ArrowRight', ['feat'])).toEqual({toggleKey: 'feat'});
    expect(action('feat', 'ArrowRight')).toEqual({focusKey: 'feat/a'});
  });

  it('collapses an expanded folder, else goes to the parent', () => {
    expect(action('feat', 'ArrowLeft')).toEqual({toggleKey: 'feat'});
    expect(action('feat/b', 'ArrowLeft')).toEqual({focusKey: 'feat'});
    expect(action('main', 'ArrowLeft')).toEqual({});
  });

  it('activates the focused node on Enter and Space', () => {
    expect(action('main', 'Enter')).toEqual({activate: true});
    expect(action('main', ' ')).toEqual({activate: true});
  });

  it('starts from the first row without focus, ignoring other keys', () => {
    expect(action(undefined, 'ArrowDown')).toEqual({focusKey: 'main'});
    expect(action(undefined, 'Enter')).toBeUndefined();
    expect(action('main', 'a')).toBeUndefined();
  });
});

describe('rowsInView', () => {
  it('renders the rows in view and the overscan around them', () =>
    expect(rowsInView(300, 200, 30, 5, 1000)).toEqual({from: 5, to: 22}));

  it('stays within the rows', () =>
    expect(rowsInView(0, 200, 30, 5, 3)).toEqual({from: 0, to: 3}));
});
