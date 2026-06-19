import * as fs from 'fs';
import { execSync } from 'child_process';
import {
  beat,
  byText,
  initRepo,
  jsClick,
  rightClick,
  waitForMerge,
} from './utils/helpers.js';

// ── Fixture ───────────────────────────────────────────────────────────────────
// Two branches that both modify the same line in app.js, guaranteeing a conflict
// when rebasing main onto feature.
//
//   initial: app.js = "const version = 'base';"
//   feature: app.js = "const version = 'feature';"   (branched from initial)
//   main:    app.js = "const version = 'main';"      (also from initial)

const TPL = '/tmp/gitgud-rebase-conflict';

function createFixture(): void {
  if (fs.existsSync(TPL)) fs.rmSync(TPL, { recursive: true });
  fs.mkdirSync(TPL);
  const g = (cmd: string) => execSync(`git -C "${TPL}" ${cmd}`, { stdio: 'pipe' });

  g('init -b main');
  g('config user.name "Test Dev"');
  g('config user.email "test@gitgud.dev"');

  fs.writeFileSync(`${TPL}/app.js`, "const version = 'base';\n");
  g('add -A');
  g('commit -m "feat: initial commit"');

  g('checkout -b feature');
  fs.writeFileSync(`${TPL}/app.js`, "const version = 'feature';\n");
  g('add -A');
  g('commit -m "feat: feature version"');

  g('checkout main');
  fs.writeFileSync(`${TPL}/app.js`, "const version = 'main';\n");
  g('add -A');
  g('commit -m "feat: main version"');
}

// ── Context-menu helpers ──────────────────────────────────────────────────────

const waitForMenuItem = (label: string) =>
  $(`//li[contains(@class,"p-contextmenu-item")][contains(.,"${label}")]`)
    .waitForDisplayed({ timeout: 5_000, timeoutMsg: `menu item "${label}" never appeared` });

const clickMenuItem = async (label: string) =>
  browser.execute((text: string) => {
    const target = Array.from(document.querySelectorAll('.p-contextmenu-item-content'))
      .find(el => el.textContent?.includes(text));
    target?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, label);

// ── Shared steps ──────────────────────────────────────────────────────────────

async function triggerRebaseMainOntoFeature(): Promise<void> {
  const featureNode = await $('//*[contains(@class,"p-tree-node-selectable")][contains(.,"feature")]');
  await rightClick(featureNode);
  await beat();
  await waitForMenuItem('Rebase main onto feature');
  await clickMenuItem('Rebase main onto feature');
}

async function waitForConflict(): Promise<void> {
  await browser.waitUntil(
    async () => (await $$('.conflicted-section tr')).length > 0,
    { timeout: 20_000, timeoutMsg: 'conflicted-section rows never appeared' },
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('rebase conflict — resolve & abort', () => {
  before(async () => {
    createFixture();
    await initRepo(TPL);
  });

  it('opens merge editor on conflict, resolves it, continues rebase to completion', async () => {
    await triggerRebaseMainOntoFeature();

    // Toolbar enters rebase mode
    await $('span.rebase-label').waitForDisplayed({ timeout: 20_000 });
    await waitForConflict();

    // Click conflicted file → three-way merge editor opens
    await jsClick(await $('.conflicted-section tr'));
    await waitForMerge();
    await expect($('.operation-badge.op-rebase')).toBeDisplayed();

    // Accept ours (first "Accept All" button)
    const acceptBtns = await $$('button.accept-all-btn');
    await jsClick(acceptBtns[0]);

    // Save & Mark Resolved — closes the merge editor
    await jsClick(await byText('button', 'Save & Mark Resolved'));
    await $('gitgud-merge-editor').waitForDisplayed({ reverse: true, timeout: 10_000 });

    // Wait until Continue becomes enabled (no more conflicted files)
    await browser.waitUntil(
      async () => {
        const disabled = await $('p-button.rebase-continue button').getAttribute('disabled');
        return disabled === null;
      },
      { timeout: 10_000, timeoutMsg: 'Continue button never became enabled after resolving conflicts' },
    );

    // Continue — our single commit is applied, rebase completes
    await jsClick(await $('p-button.rebase-continue button'));
    await $('span.rebase-label').waitForDisplayed({ reverse: true, timeout: 20_000 });

    // Verify clean state
    await expect($('span.rebase-label')).not.toBeDisplayed();
    await expect($('gitgud-merge-editor')).not.toBeDisplayed();
  });

  it('aborts rebase and restores previous branch state without conflicts', async () => {
    // Fresh copy — previous test rebased main, so we need a clean repo again
    await initRepo(TPL);

    await triggerRebaseMainOntoFeature();

    await $('span.rebase-label').waitForDisplayed({ timeout: 20_000 });
    await waitForConflict();

    // Abort without resolving anything
    await jsClick(await $('p-button.rebase-abort button'));

    // Rebase in progress label disappears
    await $('span.rebase-label').waitForDisplayed({ reverse: true, timeout: 20_000 });

    // No conflicted files remain
    await browser.waitUntil(
      async () => (await $$('.conflicted-section tr')).length === 0,
      { timeout: 10_000, timeoutMsg: 'conflicted files still showing after abort' },
    );

    // No merge editor open
    await expect($('gitgud-merge-editor')).not.toBeDisplayed();
  });
});
