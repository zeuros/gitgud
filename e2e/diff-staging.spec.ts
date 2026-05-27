import {expect, test} from '@playwright/test';
import {beat, DEMO_BASE, launchWithRepo, waitForDiff} from './utils/helpers';

test('diff viewer — view modes, staging & commit', async () => {
  const {app, page} = await launchWithRepo(DEMO_BASE);

  // ── Committed diff ──────────────────────────────────────────────────────────
  await page.locator('tr.commit-row').filter({hasText: 'add base styles'}).click();
  await beat(page);
  await page.locator('li').filter({hasText: 'styles.css'}).first().click();
  await waitForDiff(page);
  await expect(page.locator('gitgud-monaco-editor-view')).toBeVisible();

  // View mode switching
  await page.getByRole('button', {name: /inline/i}).click();
  await page.getByRole('button', {name: /hunk/i}).click();
  await page.getByRole('button', {name: /split/i}).click();
  await page.keyboard.press('Escape');

  // ── Index (working dir) ─────────────────────────────────────────────────────
  await page.locator('tr.commit-row').first().click();
  await beat(page);
  await page.locator('td').filter({hasText: 'app.js'}).first().click();
  await waitForDiff(page);
  await expect(page.locator('gitgud-monaco-editor-view')).toBeVisible();

  // Context-menu stage a single line
  const modifiedPane = page.locator('.editor.modified .view-lines .view-line').nth(2);
  await modifiedPane.click();
  await modifiedPane.click({button: 'right'});
  await expect(page.getByRole('menuitem', {name: /stage this line/i})).toBeVisible();
  await page.getByRole('menuitem', {name: /stage this line/i}).click();
  await page.keyboard.press('Escape');

  // Stage all and commit
  await page.getByRole('button', {name: 'Stage all'}).click();
  await page.locator('input.commit-summary').click();
  await page.keyboard.type('feat: add filter bar (WIP)', {delay: 30});
  await page.locator('textarea.commit-description').click();
  await page.keyboard.type('Partial implementation — filter view toggle.', {delay: 30});
  await page.getByRole('button', {name: 'Commit staged changes'}).click();
  await expect(page.locator('tr.commit-row').first()).toContainText('add filter bar');

  // Theme toggle — settings panel opens and closes
  await page.locator('button:has(span.fa-cog)').click();
  await page.locator('p-select.settings-select').click();
  await page.getByRole('option', {name: 'Light'}).click();
  await page.locator('p-select.settings-select').click();
  await page.getByRole('option', {name: 'Dark'}).click();
  await page.locator('p-select.settings-select').click();
  await page.getByRole('option', {name: 'System'}).click();
  await page.keyboard.press('Escape');

  await app.close();
});
