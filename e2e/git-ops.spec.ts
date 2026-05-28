import {ElectronApplication, expect, test} from '@playwright/test';
import {DEMO_BASE, launchWithRepo} from './utils/helpers';

let app: ElectronApplication;
test.afterEach(async () => await app?.close());

test('git ops — commit graph, branch nav, stash, create branch', async () => {
  const {page} = ({app} = await launchWithRepo(DEMO_BASE));

  // Commit graph loaded
  await expect(page.locator('tr.commit-row').first()).toBeVisible();
  const initialCount = await page.locator('tr.commit-row').count();
  expect(initialCount).toBeGreaterThan(3);

  // Branch navigation — dispatchEvent bypasses coordinate hit-testing which fails under xvfb
  await page.locator('.p-tree-node-selectable span').filter({hasText: 'dark-mode'}).first().dispatchEvent('click');
  await page.locator('.p-tree-node-selectable span').filter({hasText: 'main'}).first().dispatchEvent('click');

  // Fetch — button exists and responds
  await page.locator('button:has(i.fa-refresh)').dispatchEvent('click');

  // Stash — entry appears in graph and wip disappears
  await page.locator('button:has(i.fa-archive)').dispatchEvent('click');
  await expect(page.locator('tr.commit-row')).toHaveCount(initialCount);

  // Pop — stash entry removed
  await page.locator('button:has(i.fa-inbox)').dispatchEvent('click');
  await expect(page.locator('tr.commit-row')).toHaveCount(initialCount);

  // Create branch — appears in branch panel
  await page.locator('button:has(i.fa-code-fork)').first().dispatchEvent('click');
  await page.locator('input.branch-name-input').focus();
  await page.keyboard.type('ci/test-branch', {delay: 30});
  await page.keyboard.press('Enter');
  await expect(
    page.locator('.p-splitterpanel .p-tree-node-selectable span').filter({hasText: 'test-branch'}).nth(1),
  ).toBeVisible();

});
