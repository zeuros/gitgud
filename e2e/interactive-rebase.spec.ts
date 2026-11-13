import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { clearInput, DEMO_BASE, initRepo, jsClick, typeInto } from './utils/helpers.js';

// Rewording a past commit runs `git rebase -i` with the app's editor script, the uncommitted changes stashed around it
const rowWith = (text: string) => $(`//tr[contains(@class,"commit-row")][contains(.,"${text}")]`);

async function rewordCommit(subject: string, newSubject: string): Promise<void> {
  await jsClick(await rowWith(subject));
  const summary = await $('gitgud-commit-infos input.commit-summary');
  await browser.waitUntil(async () => (await summary.getValue()).includes(subject), { timeout: 10_000, timeoutMsg: `the details of "${subject}" never showed` });
  await clearInput(summary);
  await typeInto(summary, newSubject);
  await jsClick(await $('//gitgud-commit-infos//button[contains(.,"Update message")]'));
  await rowWith(newSubject).waitForExist({ timeout: 20_000, timeoutMsg: `"${newSubject}" never showed in the log` });
}

describe('interactive rebase — reword past commits', () => {
  let repoDir: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trimEnd();

  before(async () => {
    repoDir = await initRepo(DEMO_BASE);
  });

  it('rewords two past commits in a row, keeping the uncommitted changes', async () => {
    const subjectsBefore = git('log', '--format=%s').split('\n');
    const statusBefore = git('status', '--porcelain');

    await rewordCommit('feat: add base styles', 'feat: add the base styles');
    await rewordCommit('feat: add HTML structure', 'feat: add the HTML structure');

    // Same history but the two subjects, no rebase left in progress, the uncommitted changes back in place and their stash gone
    expect(git('log', '--format=%s').split('\n')).toEqual(subjectsBefore.map(subject => ({
      'feat: add base styles': 'feat: add the base styles',
      'feat: add HTML structure': 'feat: add the HTML structure',
    })[subject] ?? subject));
    expect(fs.existsSync(path.join(repoDir, '.git', 'rebase-merge'))).toBe(false);
    expect(git('status', '--porcelain')).toBe(statusBefore);
    expect(git('stash', 'list')).toBe('');
    await expect($('span.operation-label')).not.toBeDisplayed();
  });
});
