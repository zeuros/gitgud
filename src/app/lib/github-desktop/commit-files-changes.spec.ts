import {describe, expect, it} from 'vitest';
import {parseRawLogWithNumstat} from './commit-files-changes';
import {diffSides} from '../../services/file-diff.service';

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
});
