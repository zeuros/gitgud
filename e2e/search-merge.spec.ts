import {expect, test} from '@playwright/test';
import {DEMO_BASE, DEMO_CONFLICT, electronReload, launchWithRepo, waitForMerge} from './utils/helpers';

test('graph search, git command log & merge editor', async () => {
  const {app, page} = await launchWithRepo(DEMO_BASE);

  // ── Graph search ────────────────────────────────────────────────────────────
  await page.keyboard.press('Control+f');
  await page.waitForSelector('gitgud-search-logs input[name="search"]');

  // Search by keyword
  await page.locator('gitgud-search-logs input[name="search"]').type('keyboard', {delay: 50});
  await expect(page.locator('tr.commit-row').first()).toBeVisible();

  // Search by SHA prefix
  await page.locator('gitgud-search-logs input[name="search"]').clear();
  const firstSha = await page.locator('tr.commit-row').first().getAttribute('id') ?? '';
  const shaPrefix = firstSha.slice(0, 7);
  if (shaPrefix) {
    await page.locator('gitgud-search-logs input[name="search"]').type(shaPrefix, {delay: 50});
    await expect(page.locator('tr.commit-row').first()).toBeVisible();
  }

  // Search by author
  await page.locator('gitgud-search-logs input[name="search"]').clear();
  await page.locator('gitgud-search-logs input[name="search"]').type('Demo Dev', {delay: 50});
  await expect(page.locator('tr.commit-row').first()).toBeVisible();
  await page.keyboard.press('Escape');

  // ── Git command log ─────────────────────────────────────────────────────────
  await page.locator('button:has(span.fa-terminal)').click();
  await expect(page.getByText('Git Command History')).toBeVisible();
  await page.keyboard.press('Escape');

  // ── Merge editor ────────────────────────────────────────────────────────────
  await page.evaluate((conflictDir: string) => {
    const repos = JSON.parse(localStorage.getItem('GitRepositories') ?? '[]');
    repos.push({
      id: conflictDir, name: 'todo-app (merge conflict)',
      selected: true, logs: [], stashes: [], tags: [], remoteTags: [], branches: [],
      selectedCommitsShas: ['index'], startCommit: 0, remotes: [],
      editorConfig: {viewType: 'split'}, workDirStatus: {unstaged: [], staged: [], conflicted: []},
    });
    localStorage.setItem('GitRepositories', JSON.stringify(repos));
  }, DEMO_CONFLICT);

  await electronReload(app, page);
  await page.waitForSelector('tr.commit-row', {timeout: 15_000});
  await page.locator('p-tab').last().click();
  await expect(page.locator('.conflicted-section')).toBeVisible({timeout: 10_000});

  // Conflicted file opens three-way merge editor
  await page.locator('.conflicted-section tr').first().click();
  await waitForMerge(page);
  await expect(page.locator('gitgud-merge-editor')).toBeVisible();

  // Accept ours and theirs for individual hunks
  await page.getByRole('button', { name: '↑ Accept All', description: 'Accept all ours', exact: true }).click();
  await page.getByRole('button', { name: '↑ Accept All', description: 'Accept all theirs', exact: true }).click();

  // Mark as resolved
  await page.getByRole('button', { name: ' Save & Mark Resolved' }).first().click();
  await expect(page.locator('gitgud-merge-editor')).not.toBeVisible({timeout: 10_000});

  await app.close();
});
