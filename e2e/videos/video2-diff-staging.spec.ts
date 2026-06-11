/**
 * Video 2 — Diff Viewer, Staging & Theme
 * Showcases: committed diff · hunk/inline/split views
 *            partial line staging · stage all · commit · light/dark theme
 */
import {test} from '@playwright/test';
import {beat, DEMO_BASE, launchWithRepo, see, waitForDiff} from '../utils/helpers';
import {annotateWithArrowAndText, setupAnnotations} from '../utils/annotateWithArrowAndText';

test('video2 – diff viewer and staging', async () => {
  const {page, close} = await launchWithRepo(DEMO_BASE, {record: true});
  await setupAnnotations(page);

  // ── 1. Click a committed file to open the diff viewer ───────────────────────
  await page.locator('tr.commit-row').filter({hasText: 'add base styles'}).click();
  await beat(page);
  await page.locator('li').filter({hasText: 'styles.css'}).first().click();
  await waitForDiff(page);
  await annotateWithArrowAndText(page, 'gitgud-monaco-editor-view', 'Monaco diff viewer\nSplit view — changed lines highlighted', 'right');

  // ── 2. Switch diff views ─────────────────────────────────────────────────────
  const inlineBtn = page.getByRole('button', {name: /inline/i});
  await annotateWithArrowAndText(page, inlineBtn, 'Switch between Inline · Hunk · Split', 'bottom');
  await inlineBtn.click();
  await see(page, 1000);
  await page.getByRole('button', {name: /hunk/i}).click();
  await see(page, 1000);
  await page.getByRole('button', {name: /split/i}).click();
  await see(page, 800);

  await page.keyboard.press('Escape');
  await beat(page);

  // ── 3. Click the "index" commit row (working dir changes) ────────────────────
  await page.locator('tr.commit-row').first().click();
  await beat(page);
  await page.locator('td').filter({hasText: 'app.js'}).first().click();
  await waitForDiff(page);
  await annotateWithArrowAndText(page, 'gitgud-monaco-editor-view', 'Unstaged changes\nRight-click any line to stage it', 'right');

  // ── 4. Partial staging — right-click → Stage this line ──────────────────────
  const modifiedPane = page.locator('.editor.modified .view-lines .view-line').nth(2);
  await modifiedPane.click();
  await modifiedPane.click({button: 'right'});
  await see(page, 600);
  await annotateWithArrowAndText(page, '[role="menuitem"]', 'Stage a single line\nwithout touching the rest of the file', 'right');
  await page.getByRole('menuitem', {name: /stage this line/i}).click();

  await page.keyboard.press('Escape');
  await beat(page);

  // ── 5. Stage all remaining files ────────────────────────────────────────────
  await annotateWithArrowAndText(page, 'button:has-text("Stage all")', 'Stage every change at once', 'bottom');
  await page.getByRole('button', {name: 'Stage all'}).click();
  await see(page, 800);

  // ── 6. Commit ───────────────────────────────────────────────────────────────
  await annotateWithArrowAndText(page, 'input.commit-summary', 'Commit summary\nand optional multi-line description below', 'bottom');
  await page.locator('input.commit-summary').click();
  await page.keyboard.type('feat: add filter bar (WIP)', {delay: 55});
  await page.locator('textarea.commit-description').click();
  await page.keyboard.type('Partial implementation — filter view toggle.\nWill be completed in next sprint.', {delay: 40});
  await annotateWithArrowAndText(page, 'button:has-text("Commit staged changes")', 'One click to commit', 'bottom');
  await page.getByRole('button', {name: 'Commit staged changes'}).click();
  await see(page, 1200);
  await annotateWithArrowAndText(page, 'tr.commit-row:nth-child(1)', 'New commit appears at HEAD', 'right');

  // ── 7. Light / dark theme ───────────────────────────────────────────────────
  await annotateWithArrowAndText(page, 'button:has(span.fa-cog)', 'Settings — toggle theme', 'bottom');
  await page.locator('button:has(span.fa-cog)').click();
  await see(page, 600);
  await page.locator('p-select.settings-select').click();
  await see(page, 600);
  await page.getByRole('option', {name: 'Light'}).click();
  await see(page, 1200);
  await page.locator('p-select.settings-select').click();
  await see(page, 600);
  await page.getByRole('option', {name: 'Dark'}).click();
  await see(page, 1200);
  await page.keyboard.press('Escape');

  await close();
});
