import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { allByText, beat, byText, DEMO_BASE, initRepoWithWorktrees, jsClick, typeInto } from './utils/helpers.js';

const otherWorktreeWipRow = '//tr[contains(@class,"commit-row")][.//gitgud-worktree-badge]';

describe('Work in progress of another worktree', () => {
  let repoDir: string;
  let worktreeDir: string;

  before(async () => {
    ({ repoDir, worktreeDir } = await initRepoWithWorktrees(DEMO_BASE));
  });

  it('shows its row once a file changes there, and commits it without leaving the tab\'s worktree', async () => {
    const mainStatusBefore = execSync(`git -C "${repoDir}" status --porcelain`).toString();

    fs.writeFileSync(path.join(worktreeDir, 'worktree-note.txt'), 'written in the linked worktree\n');
    await $(otherWorktreeWipRow).waitForExist({ timeout: 15_000, timeoutMsg: 'the other worktree\'s WIP row never appeared' });

    // Its changes, not the tab's worktree's, fill the right panel
    await jsClick(await $(otherWorktreeWipRow));
    await browser.waitUntil(async () => (await allByText('td', 'worktree-note.txt')).length > 0,
      { timeout: 10_000, timeoutMsg: 'the other worktree\'s file never showed in the right panel' });
    expect(await allByText('td', 'app.js')).toHaveLength(0);

    await jsClick(await byText('button', 'Stage all'));
    await browser.waitUntil(
      () => execSync(`git -C "${worktreeDir}" diff --cached --name-only`).toString().includes('worktree-note.txt'),
      { timeout: 10_000, timeoutMsg: 'the file was never staged in the other worktree' },
    );
    await typeInto(await $('input.commit-summary'), 'docs: note from the linked worktree');
    await jsClick(await byText('button', 'Commit staged changes'));

    await browser.waitUntil(
      () => execSync(`git -C "${worktreeDir}" log -1 --format=%s`).toString().trim() === 'docs: note from the linked worktree',
      { timeout: 10_000, timeoutMsg: 'the commit never landed in the other worktree' },
    );
    await $(otherWorktreeWipRow).waitForExist({ reverse: true, timeout: 10_000, timeoutMsg: 'the WIP row stayed once the worktree was clean' });
    await beat();

    // The tab's worktree kept its own work in progress and branch
    expect(execSync(`git -C "${repoDir}" status --porcelain`).toString()).toBe(mainStatusBefore);
    expect(execSync(`git -C "${repoDir}" log -1 --format=%s`).toString().trim()).not.toBe('docs: note from the linked worktree');
  });
});
