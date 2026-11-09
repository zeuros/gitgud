import {describe, expect, it} from 'vitest';
import {amendFromFile, gitPath} from './git-path.utils';

const worktree = {gitDir: '/repo/.git/worktrees/wt', commonDir: '/repo/.git'};

describe('gitPath', () => {
  it('keeps the per-worktree state in the worktree git dir', () => {
    for (const name of ['index.lock', 'rebase-merge', 'FETCH_HEAD', 'MERGE_HEAD'] as const)
      expect(gitPath(worktree, name)).toBe(`/repo/.git/worktrees/wt/${name}`);
  });

  it('shares refs with the main repository', () =>
    expect(gitPath(worktree, 'refs/stash')).toBe('/repo/.git/refs/stash'));
});

describe('amendFromFile', () => {
  it('quotes the path for the shell', () =>
    expect(amendFromFile("/my repo/it's")).toBe(`exec git commit --amend -F '/my repo/it'\\''s' && rm '/my repo/it'\\''s'`));
});
