import {describe, expect, it} from 'vitest';
import {moveSelection, type RowSelection, selectAll, selectRow} from './row-selection';

const rows = ['a', 'b', 'c', 'd', 'e', 'f'];
const none: RowSelection = {keys: []};

describe('selectRow', () => {
  it('selects the clicked row only', () =>
    expect(selectRow(rows, {keys: ['a', 'b'], anchor: 0, rangeEnd: 1}, 3)).toEqual({keys: ['d'], anchor: 3, rangeEnd: 3}));

  it('toggles rows with ctrl, in selection order', () => {
    const one = selectRow(rows, none, 3);
    const two = selectRow(rows, one, 1, {ctrl: true});
    expect(two.keys).toEqual(['d', 'b']);
    expect(selectRow(rows, two, 3, {ctrl: true}).keys).toEqual(['b']);
  });

  // Like PrimeNG: a shift range is rebuilt in row order, the anchor included
  it('selects from the anchor to the row with shift, either way', () => {
    const anchored = selectRow(rows, none, 1);
    expect(selectRow(rows, anchored, 4, {shift: true}).keys).toEqual(['b', 'c', 'd', 'e']);
    expect(selectRow(rows, selectRow(rows, none, 4), 1, {shift: true}).keys).toEqual(['b', 'c', 'd', 'e']);
  });

  it('replaces the previous shift range, keeping the anchor', () => {
    const range = selectRow(rows, selectRow(rows, none, 2), 5, {shift: true});
    expect(selectRow(rows, range, 0, {shift: true})).toEqual({keys: ['a', 'b', 'c'], anchor: 2, rangeEnd: 0});
  });

  it('keeps rows toggled with ctrl outside the shift range', () => {
    const toggled = selectRow(rows, selectRow(rows, none, 0), 4, {ctrl: true}); // a, e; anchor e
    expect(selectRow(rows, toggled, 5, {shift: true}).keys).toEqual(['a', 'e', 'f']);
  });

  it('selects the row with shift when nothing anchors a range', () =>
    expect(selectRow(rows, none, 2, {shift: true})).toEqual({keys: ['c'], anchor: 2, rangeEnd: 2}));

  it('ignores an index out of the rows', () =>
    expect(selectRow(rows, {keys: ['a'], anchor: 0, rangeEnd: 0}, 9)).toEqual({keys: ['a'], anchor: 0, rangeEnd: 0}));
});

describe('moveSelection', () => {
  it('moves a single selection down and up, staying within the rows', () => {
    const at4 = selectRow(rows, none, 4);
    expect(moveSelection(rows, at4, 1).keys).toEqual(['f']);
    expect(moveSelection(rows, moveSelection(rows, at4, 1), 1).keys).toEqual(['f']);
    expect(moveSelection(rows, at4, -1).keys).toEqual(['d']);
  });

  it('starts from the first row when nothing is selected', () =>
    expect(moveSelection(rows, none, 1).keys).toEqual(['a']));

  it('extends from the anchor with shift', () => {
    const at2 = selectRow(rows, none, 2);
    const down2 = moveSelection(rows, moveSelection(rows, at2, 1, {shift: true}), 1, {shift: true});
    expect(down2.keys).toEqual(['c', 'd', 'e']);
    expect(moveSelection(rows, down2, -3, {shift: true}).keys).toEqual(['b', 'c']);
  });

  it('moves from the extended end of a range without shift', () => {
    const range = moveSelection(rows, moveSelection(rows, selectRow(rows, none, 1), 1, {shift: true}), 1, {shift: true}); // b-d
    expect(moveSelection(rows, range, -1)).toEqual({keys: ['c'], anchor: 2, rangeEnd: 2});
  });

  it('jumps to the first / last row', () => {
    expect(moveSelection(rows, selectRow(rows, none, 3), -Infinity).keys).toEqual(['a']);
    expect(moveSelection(rows, selectRow(rows, none, 3), Infinity).keys).toEqual(['f']);
  });
});

describe('selectAll', () => {
  it('selects every row in order', () => expect(selectAll(rows).keys).toEqual(rows));
});
