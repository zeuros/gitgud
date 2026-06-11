/**
 * Video 1 — Core Git Operations & Navigation
 * Showcases: commit graph · branch panel · fetch · stash/pop · branch creation · tab switching
 */
import {test} from '@playwright/test';
import {DEMO_BASE, electronReload, launchWithRepo} from '../utils/helpers';
import {annotateWithArrowAndText, setupAnnotations} from '../utils/annotateWithArrowAndText';


test('video1 – git operations', async () => {
  const {app, page} = await launchWithRepo(DEMO_BASE, {record: true});

  await setupAnnotations(page);

  // ── 1. Commit graph ─────────────────────────────────────────────────────────
  await annotateWithArrowAndText(page, 'tr.commit-row:nth-child(3)', 'Full commit history\nEvery branch & tag', 'right');

  // ── 2. Branch panel ─────────────────────────────────────────────────────────
  await page.locator('.p-tree-node-selectable span').filter({hasText: 'dark-mode'}).first().click();
  await annotateWithArrowAndText(page, '.p-tree-node-selectable span:has-text("dark-mode")', 'Local & remote branches', 'bottom', 0, 0, 2500);
  await page.locator('.p-tree-node-selectable span').filter({hasText: 'local-storage'}).first().click();
  await annotateWithArrowAndText(page, '.p-tree-node-selectable span:has-text("local-storage")', 'Click a branch to jump to its commit', 'bottom', 0, 0, 2500);
  await page.locator('.p-tree-node-selectable span').filter({hasText: 'main'}).first().click();
  await annotateWithArrowAndText(page, '.p-tree-node-selectable span:has-text("main")', 'Click a branch to jump to its commit', 'bottom', 0, 0, 2500);

  // ── 3. Fetch ────────────────────────────────────────────────────────────────
  await annotateWithArrowAndText(page, 'button:has(i.fa-refresh)', 'Fetch remote changes\nNo merge — updates tracking branches', 'bottom');await page.locator('button:has(i.fa-refresh)').click();
  // ── 4. Stash ────────────────────────────────────────────────────────────────
  await annotateWithArrowAndText(page, 'button:has(i.fa-archive)', 'Stash your working directory for later', 'bottom');await page.locator('button:has(i.fa-archive)').click();await annotateWithArrowAndText(page, 'tr.commit-row:nth-child(1)', 'Stash appears in graph\nWorking dir is clean', 'right');

  // ── 5. Pop stash ────────────────────────────────────────────────────────────
  await annotateWithArrowAndText(page, 'button:has(i.fa-inbox)', 'Pop restores stashed changes\nand removes the entry', 'bottom');
  await page.locator('button:has(i.fa-inbox)').click();

  // ── 6. Create branch ────────────────────────────────────────────────────────
  await annotateWithArrowAndText(page, 'button:has(i.fa-code-fork)', 'New branch at HEAD\nNo checkout — type name + Enter', 'bottom');
  await page.locator('button:has(i.fa-code-fork)').first().click();
  await page.keyboard.type('demo/new-feature', {delay: 60});
  await page.keyboard.press('Enter');
  await annotateWithArrowAndText(page, 'tr.commit-row:nth-child(1)', 'demo/new-feature created at HEAD', 'right');

  // ── 7. Tab switching ─────────────────────────────────────────────────────────
  await page.evaluate(() => {
    const repos = JSON.parse(localStorage.getItem('GitRepositories') ?? '[]');
    repos.push({
      id: '/home/zeuros/Documents/gitgud', name: 'gitgud',
      selected: false, logs: [], stashes: [], tags: [], remoteTags: [], branches: [],
      selectedCommitsShas: ['index'], startCommit: 0, remotes: [],
      editorConfig: {viewType: 'split'}, workDirStatus: {unstaged: [], staged: [], conflicted: []},
    });
    localStorage.setItem('GitRepositories', JSON.stringify(repos));
  });
  await electronReload(app, page);
  await page.waitForFunction(
    () => document.querySelectorAll('tr.commit-row').length > 0,
    {timeout: 10_000},
  );
  await annotateWithArrowAndText(page, 'p-tab', 'Multiple repos in tabs\nEach keeps its own state', 'bottom');
  await page.locator('p-tab').nth(1).click();
  await annotateWithArrowAndText(page, 'p-tab', 'Switch repos instantly', 'bottom');
  await page.locator('p-tab').nth(0).click();

  await app.close();
});
