import {describe, expect, it} from 'vitest';
import {parseBlame, parseFileHistory, startsBlameBlock} from './file-history.utils';
import {AppFileStatusKind} from '../lib/github-desktop/model/status';

describe('parseFileHistory', () => {
  it('reads commits with the path the file had in each of them', () => {
    const output = '\x1eccc\x1fAda\x1f2026-01-03T10:00:00+01:00\x1fEdit\n\nM\tnew.txt\n'
      + '\x1ebbb\x1fBob\x1f2026-01-02T10:00:00+01:00\x1fRename\n\nR100\told.txt\tnew.txt\n'
      + '\x1eaaa\x1fBob\x1f2026-01-01T10:00:00+01:00\x1fAdd\n\nA\told.txt\n';

    const history = parseFileHistory(output);

    expect(history.map(e => [e.sha, e.summary, e.path])).toEqual([['ccc', 'Edit', 'new.txt'], ['bbb', 'Rename', 'new.txt'], ['aaa', 'Add', 'old.txt']]);
    expect(history[1].status).toEqual({kind: AppFileStatusKind.Renamed, oldPath: 'old.txt'});
    expect(history[2].status).toEqual({kind: AppFileStatusKind.New});
    expect(history[0].author).toBe('Ada');
    expect(history[0].date.toISOString()).toBe('2026-01-03T09:00:00.000Z');
  });

  it('returns nothing for an empty log', () => {
    expect(parseFileHistory('')).toEqual([]);
  });
});

describe('parseBlame', () => {
  const a = 'a'.repeat(40);
  const b = 'b'.repeat(40);
  const output = [
    `${a} 1 1 2`, 'author Ada', 'author-mail <ada@x>', 'author-time 1767225600', 'author-tz +0000', 'summary First', 'filename old.txt', '\tline one',
    `${a} 2 2`, '\t\tindented',
    `${b} 3 3 1`, 'author Bob', 'author-time 1767312000', 'summary Second', 'previous ' + a + ' old.txt', 'filename new.txt', '\tline three',
    `${'0'.repeat(40)} 4 4 1`, 'author Not Committed Yet', 'author-time 1767312000', 'summary Version of new.txt', 'filename new.txt', '\tauthor of nothing',
    '',
  ].join('\n');

  it('attributes each line to its commit', () => {
    const blame = parseBlame(output);

    expect(blame.lines.map(l => [l.sha[0], l.text])).toEqual([['a', 'line one'], ['a', '\tindented'], ['b', 'line three'], ['0', 'author of nothing']]);
    expect(blame.commits.get(a)).toMatchObject({author: 'Ada', summary: 'First', path: 'old.txt', committed: true});
    expect(blame.commits.get(b)).toMatchObject({author: 'Bob', summary: 'Second', path: 'new.txt'});
    expect(blame.commits.get(b)!.date.toISOString()).toBe('2026-01-02T00:00:00.000Z');
    expect(blame.commits.get('0'.repeat(40))!.committed).toBe(false);
  });

  it('finds where blocks start', () => {
    const blame = parseBlame(output);
    expect(blame.lines.map((_, i) => startsBlameBlock(blame, i))).toEqual([true, false, true, true]);
  });
});
