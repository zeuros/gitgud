import {expect, test} from '@playwright/test';
import {DEMO_BASE, launchWithRepo} from './utils/helpers';

test('git ops — commit graph, branch nav, stash, create branch', async () => {
  const {app, page} = await launchWithRepo(DEMO_BASE);

  // Commit graph loaded
  await expect(page.locator('tr.commit-row').first()).toBeVisible();
  const initialCount = await page.locator('tr.commit-row').count();
  expect(initialCount).toBeGreaterThan(3);

  // Branch navigation — clicking a branch scrolls the graph to its HEAD
  await page.locator('.p-tree-node-selectable span').filter({hasText: 'dark-mode'}).first().click();
  await page.locator('.p-tree-node-selectable span').filter({hasText: 'main'}).first().click();

  // Fetch — button exists and responds
  await page.locator('button:has(i.fa-refresh)').click();

  // Stash — entry appears in graph and wip disappears
  await page.locator('button:has(i.fa-archive)').click();
  await expect(page.locator('tr.commit-row')).toHaveCount(initialCount);

  // Pop — stash entry removed
  await page.locator('button:has(i.fa-inbox)').click();
  await expect(page.locator('tr.commit-row')).toHaveCount(initialCount);

  // Create branch — appears in branch panel
  await page.locator('button:has(i.fa-code-fork)').first().click();
  await page.keyboard.type('ci/test-branch', {delay: 30});
  await page.keyboard.press('Enter');
  await expect(
    page.locator('.p-splitterpanel .p-tree-node-selectable span').filter({hasText: 'test-branch'}).nth(1),
  ).toBeVisible();

  await app.close();
});
