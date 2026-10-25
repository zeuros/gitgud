import {describe, expect, it} from 'vitest';
import {detectOperationInProgress} from './operation-in-progress.utils';

const dirs = {gitDir: '/repo/.git', commonDir: '/repo/.git'};
const existing = (...names: string[]) => (path: string) => Promise.resolve(names.some(name => path === `/repo/.git/${name}`));

describe('detectOperationInProgress', () => {
  it('is undefined when no operation stopped', async () =>
    expect(await detectOperationInProgress(dirs, existing())).toBeUndefined());

  it('tells each operation from its state file', async () => {
    expect(await detectOperationInProgress(dirs, existing('rebase-merge'))).toBe('rebase');
    expect(await detectOperationInProgress(dirs, existing('rebase-apply/rebasing'))).toBe('rebase');
    expect(await detectOperationInProgress(dirs, existing('CHERRY_PICK_HEAD'))).toBe('cherry-pick');
    expect(await detectOperationInProgress(dirs, existing('REVERT_HEAD'))).toBe('revert');
    expect(await detectOperationInProgress(dirs, existing('MERGE_HEAD'))).toBe('merge');
  });

  it('is a rebase when the rebase stopped on a merge', async () =>
    expect(await detectOperationInProgress(dirs, existing('rebase-merge', 'MERGE_HEAD'))).toBe('rebase'));

  it('ignores a stopped git am', async () =>
    expect(await detectOperationInProgress(dirs, existing('rebase-apply', 'rebase-apply/applying'))).toBeUndefined());
});
