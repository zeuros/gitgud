import {describe, expect, it} from 'vitest';
import {Branch, BranchType} from '../lib/github-desktop/model/branch';
import {toLocalAndRemotePairs} from './branch-utils';

const tip = {sha: 'abc', author: undefined!};
const localBranch = (name: string, upstream: string | null = null, isHeadPointed = false) =>
  new Branch(name, upstream, tip, BranchType.Local, `refs/heads/${name}`, isHeadPointed);
const remoteBranch = (name: string) => new Branch(name, null, tip, BranchType.Remote, `refs/remotes/${name}`);

const names = (pairs: ReturnType<typeof toLocalAndRemotePairs>) =>
  pairs.map(({localBranch, remoteBranch}) => [localBranch?.name ?? null, remoteBranch?.name ?? null]);

describe('toLocalAndRemotePairs', () => {
  it('pairs a local branch with its upstream on any remote', () =>
    expect(names(toLocalAndRemotePairs([localBranch('feature', 'fork/feature'), remoteBranch('fork/feature')])))
      .toEqual([['feature', 'fork/feature']]));

  it('pairs a local branch without upstream with the same name on origin', () =>
    expect(names(toLocalAndRemotePairs([remoteBranch('origin/main'), localBranch('main')])))
      .toEqual([['main', 'origin/main']]));

  it('prefers the upstream, the other remote branch keeping its own chip', () =>
    expect(names(toLocalAndRemotePairs([
      remoteBranch('origin/feature'), remoteBranch('fork/feature'), localBranch('feature', 'fork/feature'),
    ]))).toEqual([['feature', 'fork/feature'], [null, 'origin/feature']]));

  it('leaves a same-named remote branch its own chip when the upstream points elsewhere', () =>
    expect(names(toLocalAndRemotePairs([localBranch('feature', 'upstream/new-pr'), remoteBranch('fork/feature')])))
      .toEqual([['feature', null], [null, 'fork/feature']]));

  it('pairs a local branch without upstream with the same name on another remote', () =>
    expect(names(toLocalAndRemotePairs([localBranch('feature'), remoteBranch('fork/feature')])))
      .toEqual([['feature', 'fork/feature']]));

  it('puts the head-pointed pair first', () =>
    expect(names(toLocalAndRemotePairs([localBranch('a'), localBranch('b', null, true)])))
      .toEqual([['b', null], ['a', null]]));
});
