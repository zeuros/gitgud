import {describe, expect, it} from 'vitest';
import {parseMergeTreeConflicts, withConflictWarning} from './conflict-prediction.utils';

describe('conflict prediction', () => {
  it('reads conflicted paths once each', () => {
    expect(parseMergeTreeConflicts(1, 'abc123\nsrc/a.ts\nsrc/a.ts\nb.txt\n')).toEqual(['src/a.ts', 'b.txt']);
  });

  it('reports nothing for a clean merge or when git failed', () => {
    expect(parseMergeTreeConflicts(0, 'abc123\n')).toEqual([]);
    expect(parseMergeTreeConflicts(129, '')).toEqual([]);
  });

  it('flags menu items only when there are conflicts', () => {
    const item = {label: 'Merge a into b'};
    expect(withConflictWarning(item, [])).toBe(item);
    expect(withConflictWarning(item, undefined)).toBe(item);
    expect(withConflictWarning(item, ['x', 'y'])).toMatchObject({label: 'Merge a into b (2 conflicting files)', tooltipOptions: {tooltipLabel: 'x\ny'}});
  });
});
