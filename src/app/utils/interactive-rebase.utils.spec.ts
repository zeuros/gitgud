import {describe, expect, it} from 'vitest';
import {buildRebaseTodo, invalidRebaseReason, parseRebaseLog, type RebaseAction, type RebaseEntry} from './interactive-rebase.utils';

const entry = (sha: string, action: RebaseAction = 'pick', message = sha): RebaseEntry => ({sha, author: 'me', message, action});

describe('interactive rebase', () => {
  it('parses the log, keeping multi-line messages', () => {
    const entries = parseRebaseLog('bbb\x1fAda\x1fSecond\n\nWith a body\n\x1e\naaa\x1fBob\x1fFirst\n\x1e\n');
    expect(entries).toEqual([
      {sha: 'bbb', author: 'Ada', message: 'Second\n\nWith a body', action: 'pick'},
      {sha: 'aaa', author: 'Bob', message: 'First', action: 'pick'},
    ]);
  });

  it('writes the todo oldest first', () => {
    expect(buildRebaseTodo([entry('c', 'fixup'), entry('b', 'drop'), entry('a')])).toEqual(['pick a', 'drop b', 'fixup c']);
  });

  it('rewords by amending from a message file', () => {
    expect(buildRebaseTodo([entry('b', 'reword'), entry('a')])).toEqual([
      'pick a',
      'pick b',
      'exec git commit --amend -F .git/gitgud-reword-b && rm .git/gitgud-reword-b',
    ]);
  });

  it('refuses to squash the oldest kept commit', () => {
    expect(invalidRebaseReason([entry('b'), entry('a', 'squash')])).toBeDefined();
    expect(invalidRebaseReason([entry('c'), entry('b', 'fixup'), entry('a', 'drop')])).toBeDefined();
    expect(invalidRebaseReason([entry('b', 'squash'), entry('a')])).toBeUndefined();
    expect(invalidRebaseReason([entry('a', 'drop')])).toBeUndefined();
  });

  it('refuses an empty reworded message', () => {
    expect(invalidRebaseReason([entry('a', 'reword', ' ')])).toBeDefined();
  });
});
