/**
 * Video 3 — Graph Search, Merge Editor & Command Log
 * Showcases: Ctrl+F search (SHA · summary · author)
 *            transparent git command history dialog
 *            3-way merge editor for conflict resolution
 */
import {test} from '@playwright/test';
import {DEMO_BASE, DEMO_CONFLICT, electronReload, launchWithRepo, see, waitForMerge} from '../utils/helpers';
import {annotateWithArrowAndText, setupAnnotations} from '../utils/annotateWithArrowAndText';

test('video3 – search and merge editor', async () => {
  const {app, page} = await launchWithRepo(DEMO_BASE, {record: true});
  await setupAnnotations(page);
  await see(page, 800);

  // ── 1. Graph search — by commit summary words ────────────────────────────────
  await annotateWithArrowAndText(page, 'tr.commit-row:nth-child(1)', 'Press Ctrl+F to search the graph', 'right');
  await page.keyboard.press('Control+f');
  await page.waitForSelector('gitgud-search-logs input[name="search"]');
  await see(page, 500);
  await annotateWithArrowAndText(page, 'gitgud-search-logs input[name="search"]', 'Search by summary · SHA · author', 'bottom');
  await page.locator('gitgud-search-logs input[name="search"]').type('keyboard', {delay: 80});
  await see(page, 1500);

  // Clear and search by SHA prefix
  await page.locator('gitgud-search-logs input[name="search"]').clear();
  const firstSha = await page.locator('tr.commit-row').first().getAttribute('id') ??
                   await page.evaluate(() => document.querySelector('tr.commit-row')?.getAttribute('id') ?? '');
  const shaPrefix = firstSha.slice(0, 7);
  if (shaPrefix) {
    await page.locator('gitgud-search-logs input[name="search"]').type(shaPrefix, {delay: 80});
    await see(page, 1500);
  } else {
    await page.locator('gitgud-search-logs input[name="search"]').type('feat', {delay: 80});
    await see(page, 1500);
  }

  // Search by author name
  await page.locator('gitgud-search-logs input[name="search"]').clear();
  await page.locator('gitgud-search-logs input[name="search"]').type('Demo Dev', {delay: 80});
  await see(page, 1200);
  await annotateWithArrowAndText(page, 'gitgud-search-logs', 'Results filtered instantly\nacross summary, SHA, and author', 'bottom', 0, 0, 2000);

  await page.keyboard.press('Escape');
  await see(page, 800);

  // ── 2. Git command history (transparent command log) ────────────────────────
  await annotateWithArrowAndText(page, 'button:has(span.fa-terminal)', 'Every git command gitgud ran\nis logged here — full transparency', 'bottom');
  await page.locator('button:has(span.fa-terminal)').click();
  await see(page, 600);
  await page.getByText('Git Command History').waitFor();
  await annotateWithArrowAndText(page, '.p-dialog', 'Full git command history\nwith output — no black box', 'right', 0, 0, 2000);
  await see(page, 2000);
  await page.keyboard.press('Escape');
  await see(page, 800);

  // ── 3. Switch to the conflict repo for the merge editor demo ─────────────────
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
  await see(page, 1000);

  await page.locator('p-tab').last().click();
  await see(page, 2000);
  await annotateWithArrowAndText(page, '.conflicted-section', 'Conflicted files listed\nClick to open the 3-way merge editor', 'right', 0, 0, 2000);

  // ── 4. Three-way merge editor ────────────────────────────────────────────────
  await page.locator('.conflicted-section tr').first().click();
  await waitForMerge(page);
  await see(page, 2000);
  await annotateWithArrowAndText(page, 'gitgud-merge-editor', 'Three-way merge editor\nOurs · Base · Theirs side by side', 'bottom', 0, 0, 2500);

  await page.locator('gitgud-merge-editor').evaluate(
    el => el.shadowRoot?.querySelector<HTMLElement>('.msm__side-panel.msm__lhs .msm__merge-button')?.click()
  );
  await see(page, 1200);
  await annotateWithArrowAndText(page, 'gitgud-merge-editor', 'Accept ours for this hunk', 'right', 0, 0, 1500);

  await page.locator('gitgud-merge-editor').evaluate(
    el => el.shadowRoot?.querySelector<HTMLElement>('.msm__side-panel.msm__rhs .msm__merge-button')?.click()
  );
  await see(page, 1200);
  await annotateWithArrowAndText(page, 'gitgud-merge-editor', 'Accept theirs for another hunk', 'right', 0, 0, 1500);

  await page.getByRole('button', {name: /mark resolved/i}).first().click().catch(() => {});
  await see(page, 1500);
  await annotateWithArrowAndText(page, 'tr.commit-row:nth-child(1)', 'File marked resolved\nReady to commit the merge', 'right');

  await app.close();
});
