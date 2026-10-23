import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {type Commit} from '../lib/github-desktop/model/commit';
import {squashableChain, squashActions} from './rebase.utils';

const commit = (sha: string, ...parentSHAs: string[]) => ({sha, parentSHAs} as unknown as Commit);

// a ← b ← c ← d, and m merges c and x
const logs = [commit('m', 'c', 'x'), commit('d', 'c'), commit('c', 'b'), commit('x', 'b'), commit('b', 'a'), commit('a')];

describe('squashableChain', () => {
  it('orders consecutive commits newest first, whatever the selection order', () =>
    expect(squashableChain(['b', 'd', 'c'], logs)?.map(c => c.sha)).toEqual(['d', 'c', 'b']));

  it('rejects a single commit', () => expect(squashableChain(['d'], logs)).toBeUndefined());

  it('rejects commits with a gap between them', () => expect(squashableChain(['d', 'b'], logs)).toBeUndefined());

  it('rejects merges', () => expect(squashableChain(['m', 'c'], logs)).toBeUndefined());

  it('rejects the root commit, there is nothing to rebase from', () => expect(squashableChain(['b', 'a'], logs)).toBeUndefined());

  it('rejects commits that are not loaded', () => expect(squashableChain(['d', 'zzz'], logs)).toBeUndefined());
});

describe('squashActions', () => {
  const writeFile = vi.fn(() => Promise.resolve());
  const amend = "exec git commit --amend -F '/repo/.git/COMMIT_EDIT_MSG' && rm '/repo/.git/COMMIT_EDIT_MSG'";

  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    writeFile.mockClear();
    vi.stubGlobal('window', {tauri: {fs: {writeFile}}});
  });

  it('melds the chain into its oldest commit, then amends it with the message, matching abbreviated shas', () =>
    expect(squashActions('/repo/.git', ['ddddddd1', 'ccccccc1', 'bbbbbbb1'], 'Squashed')([
      'pick bbbbbbb Oldest',
      'pick ccccccc Middle',
      'pick ddddddd Newest',
      'pick eeeeeee After',
    ])).toEqual([
      'pick bbbbbbb Oldest',
      'fixup ccccccc Middle',
      'fixup ddddddd Newest',
      amend,
      'pick eeeeeee After',
    ]));

  it('writes the message to the file the amend reads', () => {
    squashActions('/repo/.git', ['ccccccc1', 'bbbbbbb1'], 'Squashed\n\nBody');
    expect(writeFile).toHaveBeenCalledWith('/repo/.git/COMMIT_EDIT_MSG', 'Squashed\n\nBody');
  });

  it('ignores a commit whose message mentions a squashed sha', () =>
    expect(squashActions('/repo/.git', ['ddddddd1', 'ccccccc1'], 'Squashed')(['pick ccccccc Old', 'pick eeeeeee revert ddddddd'])).toEqual(['pick ccccccc Old', 'pick eeeeeee revert ddddddd']));
});
