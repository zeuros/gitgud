import {describe, expect, it} from 'vitest';
import {parseRawLogWithNumstat} from './commit-files-changes';
import {diffSides} from '../../services/file-diff.service';
import {AppFileStatusKind} from './model/status';

// `git diff <older> <newer> --raw --numstat -z` output for one modified file
const rangeOutput = [':100644 100644 aaaaaaa bbbbbbb M', 'src/a.ts', '36\t1\tsrc/a.ts', ''].join('\0');

describe('parseRawLogWithNumstat', () => {
  it('diffs a 2-commit range against the older commit, not the newer commit\'s parent', () => {
    const {files} = parseRawLogWithNumstat(rangeOutput, ['older', 'newer']);
    expect(files).toHaveLength(1);
    expect(diffSides(files[0])).toEqual({before: 'older', after: 'newer'});
  });

  it('diffs a single commit against its parent', () => {
    const {files} = parseRawLogWithNumstat(rangeOutput, ['sha']);
    expect(diffSides(files[0])).toEqual({before: 'sha^', after: 'sha'});
  });

  it('reads renames, copies and binary files, summing the numstat line counts', () => {
    const output = [
      ':100644 100644 a b R090', 'old/r.ts', 'new/r.ts',
      ':100644 100644 a b M', 'img.png',
      ':100644 100644 a b C075', 'c.ts', 'c2.ts',
      '2\t3\t', 'old/r.ts', 'new/r.ts',
      '-\t-\timg.png',
      '4\t0\t', 'c.ts', 'c2.ts',
      '',
    ].join('\0');
    const {files, linesAdded, linesDeleted} = parseRawLogWithNumstat(output, ['sha']);
    expect(files.map(file => [file.path, file.status.kind])).toEqual([
      ['new/r.ts', AppFileStatusKind.Renamed],
      ['img.png', AppFileStatusKind.Modified],
      ['c2.ts', AppFileStatusKind.Copied],
    ]);
    expect([linesAdded, linesDeleted]).toEqual([6, 3]);
  });

  it('reads combined diffs, the path inline or on the next line', () => {
    const output = ['::100644 100644 100644 a b c MM', 'p1', '::100644 100644 100644 a b c AD\tp2', ''].join('\0');
    const {files} = parseRawLogWithNumstat(output, ['a', 'b', 'c']);
    expect(files.map(file => [file.path, file.status.kind])).toEqual([['p1', AppFileStatusKind.Modified], ['p2', AppFileStatusKind.Deleted]]);
  });
});
