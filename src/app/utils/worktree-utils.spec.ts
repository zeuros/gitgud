import {describe, expect, it} from 'vitest';
import type {GitWorktree} from '../models/git-worktree';
import {branchesCheckedOutElsewhere, mainWorktreeOf, withoutTrailingSlash, worktreeName} from './worktree-utils';

const wt = (path: string, branch: string | undefined, isMain = false): GitWorktree =>
  ({path, branch, sha: 'abc', isDetached: !branch, isMain, isLocked: false});

const worktrees = [wt('/repo', 'main', true), wt('/repo-feature', 'feature'), wt('/repo-detached', undefined)];

describe('withoutTrailingSlash', () => {
  it('drops the trailing separators, but keeps a root', () => {
    expect(withoutTrailingSlash('/repo//')).toBe('/repo');
    expect(withoutTrailingSlash('C:\\repo\\')).toBe('C:\\repo');
    expect(withoutTrailingSlash('/')).toBe('/');
  });
});

describe('mainWorktreeOf', () => {
  it('gives the main worktree of a linked worktree', () =>
    expect(mainWorktreeOf({gitDir: '/repo/.git/worktrees/feature', commonDir: '/repo/.git'}, '/repo-feature')).toBe('/repo'));
  it('is undefined for the main worktree or a bare repository', () => {
    expect(mainWorktreeOf({gitDir: '/repo/.git', commonDir: '/repo/.git'}, '/repo')).toBeUndefined();
    expect(mainWorktreeOf({gitDir: '/bare.git/worktrees/x', commonDir: '/bare.git'}, '/x')).toBeUndefined();
  });
});

describe('branchesCheckedOutElsewhere', () => {
  it('lists the branches of the other worktrees, by name', () => {
    expect([...branchesCheckedOutElsewhere(worktrees, '/repo-feature')]).toEqual([['main', '/repo']]);
    expect([...branchesCheckedOutElsewhere(worktrees, '/repo')]).toEqual([['feature', '/repo-feature']]);
  });
});

describe('worktreeName', () => {
  it('is the folder name', () => expect(worktreeName('/home/me/gitgud-disjoint-trees/')).toBe('gitgud-disjoint-trees'));
});
