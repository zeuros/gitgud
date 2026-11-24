import {describe, expect, it} from 'vitest';
import {rowsInView, toPathTree, visibleRows} from './tree-utils';

const tree = toPathTree(['main', 'feat/a', 'feat/b', 'fix/c'], name => name, () => ({}));
const listed = (collapsedKeys: string[]) => visibleRows(tree, new Set(collapsedKeys)).map(({node, depth}) => `${depth}:${node.key}`);

describe('visibleRows', () => {
  it('lists the nodes depth first', () =>
    expect(listed([])).toEqual(['0:main', '0:feat', '1:feat/a', '1:feat/b', '0:fix', '1:fix/c']));

  it('skips the children of a collapsed folder', () =>
    expect(listed(['feat'])).toEqual(['0:main', '0:feat', '0:fix', '1:fix/c']));
});

describe('rowsInView', () => {
  it('renders the rows in view and the overscan around them', () =>
    expect(rowsInView(300, 200, 30, 5, 1000)).toEqual({from: 5, to: 22}));

  it('stays within the rows', () =>
    expect(rowsInView(0, 200, 30, 5, 3)).toEqual({from: 0, to: 3}));
});
