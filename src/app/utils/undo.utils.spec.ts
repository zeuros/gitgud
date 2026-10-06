/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {type GitRunner, journalFor, parseReflog, planRedo, planUndo, REFLOG_DEPTH, REFLOG_FORMAT, runJournaled, runPlan, toActions} from './undo.utils';

// Runs the plans against a real repository: what matters is where git ends up, not the commands we picked
let root: string;
let repo: string;

const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Solaire', GIT_AUTHOR_EMAIL: 'solaire@astora', GIT_COMMITTER_NAME: 'Solaire', GIT_COMMITTER_EMAIL: 'solaire@astora',
  GIT_EDITOR: 'true',
};

const gitIn = (cwd: string, args: string[], extraEnv: Record<string, string> = {}) =>
  execFileSync('git', args, {cwd, env: {...env, ...extraEnv}, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trimEnd();
const git = (...args: string[]) => gitIn(repo, args);

const write = (file: string, content: string) => writeFileSync(join(repo, file), content);
const commit = (file: string, content = file, message = `add ${file}`) => {
  write(file, content);
  git('add', file);
  git('commit', '-m', message);
  return head();
};

const head = () => git('rev-parse', 'HEAD');
const branch = () => git('rev-parse', '--abbrev-ref', 'HEAD');
const status = () => git('status', '--porcelain');
const reflog = () => parseReflog(git('reflog', '-n', `${REFLOG_DEPTH}`, `--format=${REFLOG_FORMAT}`));

const runner: GitRunner = async (args, {reflogAction, input} = {}) =>
  execFileSync('git', args, {
    cwd: repo, input, encoding: 'utf8', stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    env: {...env, ...(reflogAction === undefined ? {} : {GIT_REFLOG_ACTION: reflogAction})},
  });

// A git command run by the user through the app
const act = (...args: string[]) => runJournaled(args, () => runner(args), runner);

const run = async (plan: ReturnType<typeof planUndo>) => {
  if (!plan) throw new Error('Nothing to do');
  await runPlan(plan, runner);
  return plan.label;
};
const undo = () => run(planUndo(reflog()));
const redo = () => run(planRedo(reflog()));
const undoLabel = () => planUndo(reflog())?.label;
const redoLabel = () => planRedo(reflog())?.label;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gitgud-undo-'));
  repo = join(root, 'repo');
  gitIn(root, ['init', '-q', '-b', 'main', 'repo']);
  commit('a');
});

afterEach(() => rmSync(root, {recursive: true, force: true}));

describe('commit', () => {
  it('undo hands the changes back staged, redo restores the very same commit', async () => {
    const a = head();
    const b = commit('b');

    expect(await undo()).toBe('Undo commit: add b');
    expect(head()).toBe(a);
    expect(status()).toBe('A  b');

    expect(await redo()).toBe('Redo commit: add b');
    expect(head()).toBe(b);
    expect(status()).toBe('');
  });

  it('redo restores the commit even when its changes were discarded meanwhile', async () => {
    const b = commit('b');
    await undo();
    git('reset', '-q', '--hard');

    await redo();
    expect(head()).toBe(b);
    expect(status()).toBe('');
  });

  it('redo restores the commit even when its changes were unstaged meanwhile', async () => {
    const b = commit('b');
    await undo();
    git('restore', '--staged', 'b');

    await redo();
    expect(head()).toBe(b);
    expect(status()).toBe('');
  });

  it('undo of an amend goes back to the commit as it was', async () => {
    const b = commit('b');
    write('b', 'amended');
    git('commit', '-a', '--amend', '-m', 'add b, better');
    const amended = head();

    expect(await undo()).toBe('Undo amend: add b, better');
    expect(head()).toBe(b);
    expect(status()).toBe('M  b');

    await redo();
    expect(head()).toBe(amended);
    expect(status()).toBe('');
  });

  it('cannot undo the first commit of a repository', async () => {
    expect(planUndo(reflog())).toBeUndefined();
  });
});

describe('history walking', () => {
  it('successive undos walk back in history instead of toggling the last one', async () => {
    const a = head();
    const b = commit('b');
    const c = commit('c');
    const d = commit('d');

    await undo();
    expect(head()).toBe(c);
    expect(undoLabel()).toBe('Undo commit: add c');
    git('reset', '-q', '--hard'); // drop the changes handed back, so they don't pile up
    await undo();
    expect(head()).toBe(b);
    git('reset', '-q', '--hard');
    await undo();
    expect(head()).toBe(a);
    expect(undoLabel()).toBeUndefined();

    expect(redoLabel()).toBe('Redo commit: add b');
    await redo();
    expect(head()).toBe(b);
    await redo();
    expect(head()).toBe(c);
    await redo();
    expect(head()).toBe(d);
    expect(redoLabel()).toBeUndefined();
    expect(undoLabel()).toBe('Undo commit: add d');
  });

  it('a redo can be undone, and that undo redone', async () => {
    const a = head();
    const b = commit('b');

    await undo();
    await redo();
    expect(await undo()).toBe('Undo commit: add b');
    expect(head()).toBe(a);
    expect(await redo()).toBe('Redo commit: add b');
    expect(head()).toBe(b);
    expect(redoLabel()).toBeUndefined();
  });

  it('undo after undo + redo still reaches older actions', async () => {
    const a = head();
    commit('b');
    commit('c');

    await undo();
    await redo();
    await undo();
    git('reset', '-q', '--hard');
    expect(await undo()).toBe('Undo commit: add b');
    expect(head()).toBe(a);
  });

  it('a new action after an undo drops the redo, and becomes the next thing to undo', async () => {
    const a = head();
    commit('b');
    await undo();
    git('reset', '-q', '--hard');
    const c = commit('c');

    expect(redoLabel()).toBeUndefined();
    expect(undoLabel()).toBe('Undo commit: add c');
    await undo();
    expect(head()).toBe(a);
    // The undone commit b is not offered again
    expect(undoLabel()).toBeUndefined();
    await redo();
    expect(head()).toBe(c);
  });

  it('ignores actions that leave HEAD in place (stash, unstage)', async () => {
    const a = head();
    commit('b');
    write('b', 'wip');
    git('stash');
    write('c', 'c');
    git('add', 'c');
    git('reset', '-q');

    expect(await undo()).toBe('Undo commit: add b');
    expect(head()).toBe(a);
  });
});

describe('checkout', () => {
  it('undo goes back to the previous branch, redo returns', async () => {
    git('branch', 'feature');
    git('checkout', '-q', 'feature');

    expect(await undo()).toBe('Undo checkout of feature');
    expect(branch()).toBe('main');
    expect(await redo()).toBe('Redo checkout of feature');
    expect(branch()).toBe('feature');
    expect(await undo()).toBe('Undo checkout of feature');
    expect(branch()).toBe('main');
  });

  it('handles branches created on checkout and names with slashes', async () => {
    git('checkout', '-q', '-b', 'feat/bonfire');
    await undo();
    expect(branch()).toBe('main');
    await redo();
    expect(branch()).toBe('feat/bonfire');
  });

  it('undo of a detached checkout returns to the branch, redo detaches again', async () => {
    const a = head();
    commit('b');
    git('checkout', '-q', a);

    await undo();
    expect(branch()).toBe('main');
    await redo();
    expect(branch()).toBe('HEAD');
    expect(head()).toBe(a);
  });

  it('undo from a branch back to a detached HEAD', async () => {
    const a = head();
    commit('b');
    git('checkout', '-q', '--detach', a);
    git('checkout', '-q', 'main');

    await undo();
    expect(branch()).toBe('HEAD');
    expect(head()).toBe(a);
  });

  it('mixes with commits', async () => {
    git('checkout', '-q', '-b', 'feature');
    const b = commit('b');

    await undo();
    git('reset', '-q', '--hard');
    await undo();
    expect(branch()).toBe('main');
    await redo();
    expect(branch()).toBe('feature');
    await redo();
    expect(head()).toBe(b);
  });
});

describe('merge', () => {
  const featureWith = (file: string) => {
    git('checkout', '-q', '-b', 'feature');
    const tip = commit(file);
    git('checkout', '-q', 'main');
    return tip;
  };

  it('undo of a fast-forward', async () => {
    const a = head();
    const tip = featureWith('f');
    git('merge', '-q', 'feature');

    expect(await undo()).toBe('Undo merge feature');
    expect(head()).toBe(a);
    expect(status()).toBe('');
    expect(branch()).toBe('main');
    await redo();
    expect(head()).toBe(tip);
  });

  it('undo of a merge commit', async () => {
    featureWith('f');
    const b = commit('b');
    git('merge', '-q', '--no-edit', 'feature');
    const merged = head();

    await undo();
    expect(head()).toBe(b);
    expect(status()).toBe('');
    await redo();
    expect(head()).toBe(merged);
    expect(status()).toBe('');
  });

  it('undo of a merge concluded after conflicts', async () => {
    git('checkout', '-q', '-b', 'feature');
    commit('a', 'theirs', 'theirs');
    git('checkout', '-q', 'main');
    const ours = commit('a', 'ours', 'ours');
    expect(() => git('merge', 'feature')).toThrow();
    write('a', 'resolved');
    git('add', 'a');
    git('commit', '-q', '--no-edit');

    expect(await undo()).toMatch(/^Undo merge: /);
    expect(head()).toBe(ours);
    expect(status()).toBe('');
  });

  it('keeps unrelated local changes', async () => {
    const a = head();
    featureWith('f');
    git('merge', '-q', 'feature');
    write('a', 'work in progress');

    await undo();
    expect(head()).toBe(a);
    expect(status()).toBe(' M a');
  });
});

describe('cherry-pick and revert', () => {
  it('undo of a cherry-pick removes the commit', async () => {
    const a = head();
    git('checkout', '-q', '-b', 'feature');
    const f = commit('f');
    git('checkout', '-q', 'main');
    git('cherry-pick', f);
    const picked = head();

    expect(await undo()).toBe('Undo cherry-pick: add f');
    expect(head()).toBe(a);
    expect(status()).toBe('');
    await redo();
    expect(head()).toBe(picked);
  });

  it('undo of a revert', async () => {
    const b = commit('b');
    git('revert', '--no-edit', b);
    const reverted = head();

    expect(await undo()).toBe('Undo revert: "add b"');
    expect(head()).toBe(b);
    expect(status()).toBe('');
    await redo();
    expect(head()).toBe(reverted);
  });
});

describe('reset', () => {
  it('undo of a hard reset brings the commits back', async () => {
    const a = head();
    commit('b');
    const c = commit('c');
    git('reset', '-q', '--hard', a);

    expect(await undo()).toBe(`Undo reset to ${a}`);
    expect(head()).toBe(c);
    expect(status()).toBe('');
    await redo();
    expect(head()).toBe(a);
    expect(status()).toBe('');
  });

  it.each(['--soft', '--mixed'])('undo of a %s reset leaves a clean working directory', async mode => {
    commit('b');
    write('a', 'edited');
    git('add', 'a');
    const c = commit('c'); // edits a file and adds one, both left behind by the reset
    git('reset', '-q', mode, 'HEAD~1');

    await undo();
    expect(head()).toBe(c);
    expect(status()).toBe('');
  });

  it('undo of a reset keeps unrelated local changes', async () => {
    const b = commit('b');
    commit('c');
    write('a', 'work in progress');
    git('reset', '-q', '--keep', b);

    await undo();
    expect(status()).toBe(' M a');
  });
});

describe('rebase', () => {
  const diverge = () => {
    git('checkout', '-q', '-b', 'feature');
    commit('f1');
    const tip = commit('f2');
    git('checkout', '-q', 'main');
    commit('m');
    git('checkout', '-q', 'feature');
    return tip;
  };

  it('undo of a rebase puts the branch back as a whole', async () => {
    const tip = diverge();
    git('rebase', '-q', 'main');
    const rebased = head();

    expect(await undo()).toBe('Undo rebase');
    expect(head()).toBe(tip);
    expect(branch()).toBe('feature');
    expect(status()).toBe('');

    expect(await redo()).toBe('Redo rebase');
    expect(head()).toBe(rebased);
    expect(branch()).toBe('feature');
  });

  it('undo steps over a rebase to reach the action before it', async () => {
    const tip = diverge();
    git('rebase', '-q', 'main');
    await undo();
    // Next in line is the checkout of feature that preceded the rebase
    expect(await undo()).toBe('Undo checkout of feature');
    expect(branch()).toBe('main');
    await redo();
    expect(head()).toBe(tip);
  });

  it('undo of an interactive rebase (squash)', async () => {
    const b = commit('b');
    commit('c');
    const d = commit('d');
    gitIn(repo, ['rebase', '-q', '-i', b], {GIT_SEQUENCE_EDITOR: 'sed -i 2s/^pick/fixup/'});
    expect(git('rev-list', '--count', `${b}..HEAD`)).toBe('1');

    await undo();
    expect(head()).toBe(d);
    expect(status()).toBe('');
  });

  it('skips an aborted rebase', async () => {
    git('checkout', '-q', '-b', 'feature');
    commit('a', 'theirs', 'theirs');
    git('checkout', '-q', 'main');
    commit('a', 'ours', 'ours');
    expect(() => git('rebase', 'feature')).toThrow();
    git('rebase', '--abort');

    expect(undoLabel()).toBe('Undo commit: ours');
  });

  it('offers nothing while a rebase is in progress', async () => {
    git('checkout', '-q', '-b', 'feature');
    commit('a', 'theirs', 'theirs');
    git('checkout', '-q', 'main');
    commit('a', 'ours', 'ours');
    expect(() => git('rebase', 'feature')).toThrow();

    expect(planUndo(reflog())).toBeUndefined();
    expect(planRedo(reflog())).toBeUndefined();
  });
});

describe('pull', () => {
  // `repo` becomes a clone of an upstream that then gets one more commit
  const cloneWithUpstreamAhead = () => {
    const upstream = join(root, 'upstream');
    gitIn(root, ['clone', '-q', 'repo', 'upstream']);
    rmSync(repo, {recursive: true});
    gitIn(root, ['clone', '-q', 'upstream', 'repo']);
    writeFileSync(join(upstream, 'u'), 'u');
    gitIn(upstream, ['add', 'u']);
    gitIn(upstream, ['commit', '-q', '-m', 'add u']);
    return gitIn(upstream, ['rev-parse', 'HEAD']);
  };

  it('undo of a fast-forward pull', async () => {
    const upstreamTip = cloneWithUpstreamAhead();
    const before = head();
    git('pull', '-q');

    expect(await undo()).toBe('Undo pull');
    expect(head()).toBe(before);
    expect(status()).toBe('');
    await redo();
    expect(head()).toBe(upstreamTip);
  });

  it('undo of a pull --rebase', async () => {
    cloneWithUpstreamAhead();
    const local = commit('l');
    git('pull', '-q', '--rebase');
    expect(head()).not.toBe(local);

    await undo();
    expect(head()).toBe(local);
    expect(branch()).toBe('main');
    expect(status()).toBe('');
  });

  it('cannot undo the clone itself', async () => {
    cloneWithUpstreamAhead();
    expect(planUndo(reflog())).toBeUndefined();
  });
});

describe('commit drop', () => {
  it('undo of a commit dropped through an interactive rebase', async () => {
    const a = head();
    commit('b');
    const c = commit('c');
    gitIn(repo, ['rebase', '-q', '-i', '--empty=drop', a], {GIT_SEQUENCE_EDITOR: 'sed -i 1d'});
    expect(git('log', '--format=%s')).toBe('add c\nadd a');

    expect(await undo()).toBe('Undo rebase');
    expect(head()).toBe(c);
    await redo();
    expect(git('log', '--format=%s')).toBe('add c\nadd a');
  });

  it('undo of the tip commit dropped through a hard reset', async () => {
    const b = commit('b');
    git('reset', '-q', '--hard', 'HEAD~1');

    await undo();
    expect(head()).toBe(b);
    expect(status()).toBe('');
  });
});

describe('stash', () => {
  const stashes = () => git('stash', 'list', '--format=%H %gs');
  // A modified file, a staged new one and an untracked one
  const dirty = () => {
    write('a', 'edited');
    write('staged', 'staged');
    git('add', 'staged');
    write('untracked', 'untracked');
  };
  const DIRTY = ' M a\nA  staged\n?? untracked';

  it('undo of a stash gives the changes back as they were, redo stashes them again', async () => {
    dirty();
    await act('stash', '-u');
    const stashed = stashes();
    expect(status()).toBe('');

    expect(await undo()).toBe('Undo stash');
    expect(status()).toBe(DIRTY);
    expect(stashes()).toBe('');

    expect(await redo()).toBe('Redo stash');
    expect(status()).toBe('');
    // The very same stash: the actions to redo next may refer to it
    expect(stashes()).toBe(stashed);

    await undo();
    expect(status()).toBe(DIRTY);
    expect(stashes()).toBe('');
  });

  it('a stash with nothing to stash is not an action', async () => {
    commit('b');
    await act('stash', '-u');
    expect(undoLabel()).toBe('Undo commit: add b');
  });

  it('undoes stashes one after the other', async () => {
    commit('b');
    write('a', 'edited');
    await act('stash');
    write('b', 'edited');
    await act('stash');

    await undo();
    expect(status()).toBe(' M b');
    await undo();
    expect(status()).toBe(' M a\n M b');
    expect(stashes()).toBe('');
  });

  it('undo of a pop puts the stash back and cleans the working directory', async () => {
    dirty();
    await act('stash', '-u');
    const stashed = stashes();
    await act('stash', 'pop');
    expect(stashes()).toBe('');

    expect(await undo()).toMatch(/^Undo pop of stash "WIP on main: /);
    expect(status()).toBe('');
    expect(stashes()).toBe(stashed);

    await redo();
    expect(stashes()).toBe('');
    expect(status()).toBe(' M a\nA  staged\n?? untracked');
  });

  it('undo of a pop leaves alone the changes made elsewhere since', async () => {
    commit('other');
    write('a', 'edited');
    await act('stash');
    await act('stash', 'pop');
    write('other', 'work in progress');

    await undo();
    expect(status()).toBe(' M other');
  });

  it('undo of a pop keeps what was staged elsewhere', async () => {
    commit('other');
    write('untracked', 'untracked');
    await act('stash', '-u'); // a stash of untracked files only
    write('other', 'staged');
    git('add', 'other');
    await act('stash', 'pop');

    await undo();
    expect(status()).toBe('M  other');
  });

  it('undo of an apply cleans the working directory and keeps the stash', async () => {
    dirty();
    await act('stash', '-u');
    const stashed = stashes();
    await act('stash', 'apply', 'stash@{0}');

    expect(await undo()).toBe('Undo stash apply');
    expect(status()).toBe('');
    expect(stashes()).toBe(stashed);

    await redo();
    expect(status()).toBe(' M a\nA  staged\n?? untracked');
    expect(stashes()).toBe(stashed);
  });

  it('undo of a drop brings the stash back, even from the middle of the list', async () => {
    write('a', 'first');
    await act('stash');
    const first = git('rev-parse', 'stash@{0}');
    write('a', 'second');
    await act('stash');
    await act('stash', 'drop', 'stash@{1}');
    expect(stashes()).not.toContain(first);

    expect(await undo()).toMatch(/^Undo drop of stash "WIP on main: /);
    expect(stashes()).toContain(`${first} WIP on main`);
    expect(stashes().split('\n')).toHaveLength(2);

    await redo();
    expect(stashes()).not.toContain(first);
    expect(stashes().split('\n')).toHaveLength(1);
  });

  it('interleaves with commits in the order things happened', async () => {
    const a = head();
    write('a', 'edited');
    await act('stash');
    const b = commit('b');
    await act('stash', 'pop');

    expect(await undo()).toMatch(/^Undo pop/);
    expect(await undo()).toBe('Undo commit: add b');
    git('reset', '-q', '--hard');
    expect(head()).toBe(a);
    expect(await undo()).toBe('Undo stash');
    expect(status()).toBe(' M a');

    await redo();
    await redo();
    expect(head()).toBe(b);
    await redo();
    expect(status()).toBe(' M a');
    expect(redoLabel()).toBeUndefined();
  });
});

describe('branches', () => {
  const branches = () => git('for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads');

  it('undo of a branch creation', async () => {
    const before = branches();
    await act('branch', 'feature', head());
    const after = branches();

    expect(await undo()).toBe('Undo creation of branch feature');
    expect(branches()).toBe(before);
    await redo();
    expect(branches()).toBe(after);
  });

  it('undo of a branch deletion restores it where it was, upstream included', async () => {
    const a = head();
    commit('b');
    git('branch', 'feature', a);
    git('branch', '--set-upstream-to=main', 'feature');
    const before = branches();
    await act('branch', '-D', 'feature');
    expect(branches()).not.toContain('feature');

    expect(await undo()).toBe('Undo deletion of branch feature');
    expect(branches()).toBe(before);
    expect(git('rev-parse', '--abbrev-ref', 'feature@{upstream}')).toBe('main');

    await redo();
    expect(branches()).not.toContain('feature');
  });

  it('undo of a branch rename, of the current branch too', async () => {
    git('branch', 'feature');
    await act('branch', '-m', 'feature', 'feat/renamed');
    await act('branch', '-m', 'main', 'trunk');
    expect(branch()).toBe('trunk');

    expect(await undo()).toBe('Undo rename of main to trunk');
    expect(branch()).toBe('main');
    expect(await undo()).toBe('Undo rename of feature to feat/renamed');
    expect(branches()).toContain('feature ');

    await redo();
    await redo();
    expect(branch()).toBe('trunk');
    expect(branches()).toContain('feat/renamed ');
  });

  it('undo of a branch moved without being checked out', async () => {
    const a = head();
    git('branch', 'feature');
    const b = commit('b');
    await act('update-ref', 'refs/heads/feature', b);

    expect(await undo()).toBe('Undo move of branch feature');
    expect(git('rev-parse', 'feature')).toBe(a);
    expect(head()).toBe(b);
    await redo();
    expect(git('rev-parse', 'feature')).toBe(b);
  });

  it('a move of the checked out branch is undone once, through HEAD', async () => {
    const a = head();
    const b = commit('b');
    await act('update-ref', 'refs/heads/main', a);
    git('reset', '-q', '--hard');

    await undo();
    expect(head()).toBe(b);
    expect(undoLabel()).toBe('Undo commit: add b');
  });

  it('undo of a fast-forward of a branch that is not checked out', async () => {
    const a = head();
    git('branch', 'feature');
    const b = commit('b');
    await act('fetch', '.', 'main:feature');
    expect(git('rev-parse', 'feature')).toBe(b);

    expect(await undo()).toBe('Undo move of branch feature');
    expect(git('rev-parse', 'feature')).toBe(a);
    await redo();
    expect(git('rev-parse', 'feature')).toBe(b);
  });

  it('undo of a fast-forward of the checked out branch', async () => {
    const a = head();
    git('checkout', '-q', '-b', 'feature');
    const b = commit('b');
    git('checkout', '-q', 'main');
    git('merge', '-q', '--ff-only', 'feature');

    await undo();
    expect(head()).toBe(a);
    expect(branch()).toBe('main');
    await redo();
    expect(head()).toBe(b);
  });
});

describe('tags', () => {
  it('undo of a tag deletion', async () => {
    git('tag', 'v1');
    await act('tag', '-d', 'v1');
    expect(git('tag')).toBe('');

    expect(await undo()).toBe('Undo deletion of tag v1');
    expect(git('rev-parse', 'v1')).toBe(head());
    await redo();
    expect(git('tag')).toBe('');
  });

  it('undo of an annotated tag deletion keeps its message', async () => {
    git('tag', '-a', 'v1', '-m', 'first release');
    const tagObject = git('rev-parse', 'v1');
    await act('tag', '-d', 'v1');

    await undo();
    expect(git('rev-parse', 'v1')).toBe(tagObject);
    expect(git('tag', '-l', '--format=%(contents:subject)', 'v1')).toBe('first release');
  });
});

describe('remote', () => {
  const remoteRefs = () => git('ls-remote', 'origin');

  beforeEach(() => {
    gitIn(root, ['init', '-q', '--bare', 'origin.git']);
    git('remote', 'add', 'origin', join(root, 'origin.git'));
    git('push', '-q', 'origin', 'main');
  });

  it('undo of a remote branch deletion pushes it back where it was', async () => {
    git('checkout', '-q', '-b', 'feature');
    const tip = commit('f');
    git('push', '-q', 'origin', 'feature');
    git('checkout', '-q', 'main');
    const before = remoteRefs();
    await act('push', 'origin', '--delete', 'feature');
    expect(remoteRefs()).not.toContain('feature');

    expect(await undo()).toBe('Undo deletion of origin/feature');
    expect(remoteRefs()).toBe(before);
    expect(git('rev-parse', 'origin/feature')).toBe(tip);

    expect(await redo()).toBe('Redo deletion of origin/feature');
    expect(remoteRefs()).not.toContain('feature');
  });

  it('undo of a remote branch deletion works once the local branch is gone too', async () => {
    git('checkout', '-q', '-b', 'feature');
    commit('f');
    git('push', '-q', 'origin', 'feature');
    git('checkout', '-q', 'main');
    const before = remoteRefs();
    await act('push', 'origin', '--delete', 'feature');
    await act('branch', '-D', 'feature');

    await undo();
    await undo();
    expect(remoteRefs()).toBe(before);
  });

  it.each([['a lightweight', ['tag', 'v1']], ['an annotated', ['tag', '-a', 'v1', '-m', 'first release']]])('undo of the deletion of %s remote tag', async (_, tag) => {
    git(...tag);
    git('push', '-q', 'origin', 'v1');
    const before = remoteRefs();
    await act('push', 'origin', '--delete', 'v1');
    expect(remoteRefs()).not.toContain('v1');

    expect(await undo()).toBe('Undo deletion of tag v1 on origin');
    expect(remoteRefs()).toBe(before);

    await redo();
    expect(remoteRefs()).not.toContain('v1');
  });

  it('does not journal a deletion the remote refused', async () => {
    await expect(act('push', 'origin', '--delete', 'nope')).rejects.toThrow();
    expect(undoLabel()).toBeUndefined();
  });
});

describe('journal', () => {
  it('works on a detached HEAD', async () => {
    git('checkout', '-q', '--detach');
    await act('branch', 'feature');

    expect(await undo()).toBe('Undo creation of branch feature');
    expect(git('branch', '--list', 'feature')).toBe('');
  });

  it('works with a git too old for `reflog write`', async () => {
    const oldGit: GitRunner = (args, options) => args[0] == 'reflog' ? Promise.reject(new Error('unknown subcommand')) : runner(args, options);
    git('tag', 'v1');
    await runJournaled(['tag', '-d', 'v1'], () => runner(['tag', '-d', 'v1']), oldGit);

    const plan = planUndo(reflog())!;
    expect(plan.label).toBe('Undo deletion of tag v1');
    await runPlan(plan, oldGit);
    expect(git('tag')).toBe('v1');
    expect(redoLabel()).toBe('Redo deletion of tag v1');
  });

  it('leaves alone commands the reflog already tells about, and read-only ones', () => {
    for (const args of [['commit', '-m', 'x'], ['checkout', 'main'], ['branch'], ['branch', '-d', '-r', 'origin/x'], ['stash', 'list'], ['tag', 'v1'], ['fetch', '--prune'], ['push', 'origin', 'a:b']])
      expect(journalFor(args), args.join(' ')).toBeUndefined();
  });
});

describe('reflog parsing', () => {
  it('keeps tabs of the subject', async () => {
    expect(parseReflog('abc\tcommit: a\tb\ndef\tcommit (initial): x\n')).toEqual([
      {sha: 'abc', subject: 'commit: a\tb'},
      {sha: 'def', subject: 'commit (initial): x'},
    ]);
  });

  it('reads back the action behind our own entries', async () => {
    expect(toActions([
      {sha: 'b', subject: 'gitgud redo: checkout: moving from main to feature'},
      {sha: 'b', subject: 'gitgud undo: checkout: moving from main to feature'},
      {sha: 'c', subject: 'gitgud redo: commit: tidy: updating HEAD'},
      {sha: 'a', subject: 'gitgud undo: commit: tidy: moving to a'},
      {sha: 'b', subject: 'commit: tidy'},
      {sha: 'a', subject: 'commit (initial): start'},
    ])).toMatchObject([
      {kind: 'checkout', marker: 'redo', subject: 'checkout: moving from main to feature'},
      {kind: 'checkout', marker: 'undo', subject: 'checkout: moving from main to feature'},
      {kind: 'commit', marker: 'redo', subject: 'commit: tidy', prevSha: 'a'},
      {kind: 'commit', marker: 'undo', subject: 'commit: tidy', prevSha: 'b'},
      {kind: 'commit', marker: undefined, subject: 'commit: tidy', prevSha: 'a'},
      {kind: 'commit', subject: 'commit (initial): start', prevSha: undefined},
    ]);
  });
});
