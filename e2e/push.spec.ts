import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { DEMO_BASE, initRepo, jsClick } from './utils/helpers.js';

// A branch already on the remote with no upstream (pushed by a plain `git push <remote> <branch>`), its history rewritten
// since: once the upstream is chosen, push offers to force push rather than running a push git rejects
describe('push — a rewritten branch already on the remote, without upstream', () => {
  let repoDir: string;
  let remoteDir: string;
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trimEnd();

  before(async () => {
    repoDir = await initRepo(DEMO_BASE);
    remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitgud-e2e-remote-'));
    git(remoteDir, 'init', '-q', '--bare');
    git(repoDir, 'remote', 'add', 'origin', remoteDir);
    git(repoDir, 'push', '-q', 'origin', 'main');
    git(repoDir, 'commit', '-q', '--amend', '-m', 'docs: update the README');
  });

  it('force pushes once confirmed, and sets the upstream', async () => {
    await jsClick(await $('//button[.//span[normalize-space()="Push"]]'));
    const submit = $('//gitgud-set-upstream-dialog//button[normalize-space()="Submit"]');
    await submit.waitForDisplayed({ timeout: 15_000, timeoutMsg: 'the set-upstream dialog never showed' });
    await browser.waitUntil(async () => submit.isEnabled(), { timeout: 10_000, timeoutMsg: 'no remote was preselected' });
    await jsClick(await submit);

    const forcePush = $('//button[normalize-space()="Force Push"]');
    await forcePush.waitForDisplayed({ timeout: 15_000, timeoutMsg: 'the diverged branches dialog never showed' });

    await jsClick(await forcePush);
    await browser.waitUntil(async () => git(remoteDir, 'rev-parse', 'main') === git(repoDir, 'rev-parse', 'main'), {
      timeout: 20_000,
      timeoutMsg: 'the remote never got the rewritten main',
    });
    expect(git(repoDir, 'rev-parse', '--abbrev-ref', 'main@{u}')).toBe('origin/main');
  });
});
