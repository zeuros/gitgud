import {describe, expect, it} from 'vitest';
import type {Commit} from '../lib/github-desktop/model/commit';
import {commitCount, countCommitsNotIn, followSelection} from './log-utils';
import type {LogObject} from '../models/log-object';

const commit = (sha: string, ...parentSHAs: string[]) => ({sha, parentSHAs} as unknown as Commit);

// a ← b ← c ← d (main)
//      ↖ e ← f (feature)
const logs = [commit('d', 'c'), commit('f', 'e'), commit('c', 'b'), commit('e', 'b'), commit('b', 'a'), commit('a')];

describe('countCommitsNotIn', () => {
  it('counts commits ahead of an ancestor', () => expect(countCommitsNotIn('d', 'b', logs)).toBe(2));
  it('is 0 when sha is an ancestor of exceptSha', () => expect(countCommitsNotIn('b', 'd', logs)).toBe(0));
  it('counts each side of diverged branches', () => {
    expect(countCommitsNotIn('d', 'f', logs)).toBe(2);
    expect(countCommitsNotIn('f', 'd', logs)).toBe(2);
  });
  it('is 0 for the same sha', () => expect(countCommitsNotIn('d', 'd', logs)).toBe(0));
});

describe('commitCount', () => {
  it('pluralizes', () => {
    expect(commitCount(1)).toBe('1 commit');
    expect(commitCount(3)).toBe('3 commits');
  });
});

describe('followSelection', () => {
  // Author date in seconds identifies a commit across rewrites
  const entry = (sha: string, authorDate: number, parentSHAs: string[], summary = sha) =>
    ({sha, parentSHAs, summary, author: {email: 'me@x', date: new Date(authorDate * 1000)}} as unknown as LogObject);
  const indexRow = (parentSha: string) => ({sha: 'index', parentSHAs: [parentSha], author: {}} as unknown as LogObject);

  // a ← b ← c ← d (main), b ← e ← f (feature)
  const [a, b, c, d, e, f] = [entry('a', 1, []), entry('b', 2, ['a']), entry('c', 3, ['b']), entry('d', 4, ['c']), entry('e', 5, ['b']), entry('f', 6, ['e'])];
  const previousLog = [d, f, c, e, b, a];

  it('keeps a selection still in the log', () => expect(followSelection(['c'], previousLog, previousLog)).toEqual(['c']));
  it('selects the parent of a dropped commit', () =>
    expect(followSelection(['c'], previousLog, [entry('d2', 4, ['b']), f, e, b, a])).toEqual(['b']));
  it('selects the start commit of a deleted branch', () =>
    expect(followSelection(['f'], previousLog, [d, c, b, a])).toEqual(['b']));
  it('follows a reworded commit', () =>
    expect(followSelection(['c'], previousLog, [entry('d2', 4, ['c2']), entry('c2', 3, ['b'], 'reworded'), f, e, b, a])).toEqual(['c2']));
  it('prefers the rewritten commit with the same summary', () =>
    expect(followSelection(['c'], previousLog, [entry('x', 3, ['c2'], 'other'), entry('c2', 3, ['b'], 'c'), b, a])).toEqual(['c2']));
  it('selects the squash result of a commit squashed into its parent', () =>
    expect(followSelection(['d'], previousLog, [entry('cd', 3, ['b'], 'c'), f, e, b, a])).toEqual(['cd']));
  it('selects the commit now on the same row when the walk leaves the loaded log', () =>
    expect(followSelection(['z'], [d, entry('z', 9, ['y']), c], [d, c, b])).toEqual(['c']));
  it('clamps that row to the end of the log', () =>
    expect(followSelection(['z'], [d, c, b, entry('z', 9, ['y'])], [d, c])).toEqual(['c']));
  it('selects the top row when nothing is selected', () => expect(followSelection([], [], previousLog)).toEqual(['d']));
  it('maps each commit of a multi-selection and removes duplicates', () =>
    expect(followSelection(['c', 'd', 'e'], previousLog, [b, a, e])).toEqual(['b', 'e']));
  it('keeps the index row while shown, and selects its parent once gone', () => {
    expect(followSelection(['index'], [indexRow('d'), ...previousLog], [indexRow('d'), ...previousLog])).toEqual(['index']);
    expect(followSelection(['index'], [indexRow('d'), ...previousLog], previousLog)).toEqual(['d']);
  });
  it('leaves the selection alone while the log is empty', () => expect(followSelection(['c'], previousLog, [])).toEqual(['c']));
});
