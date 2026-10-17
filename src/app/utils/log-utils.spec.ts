import {describe, expect, it} from 'vitest';
import {Commit} from '../lib/github-desktop/model/commit';
import {commitCount, countCommitsNotIn} from './log-utils';

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
