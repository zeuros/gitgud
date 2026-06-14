import {
  beat,
  clearInput,
  DEMO_BASE,
  initRepoWithWorktrees,
  jsClick,
  jsClickAt,
  rightClickAt,
  see,
  typeInto,
} from './utils/helpers.js';

/** Wait for a context-menu item with the given label text to be displayed (uses the li wrapper). */
const waitForMenuItem = (label: string) =>
  $(`//li[contains(@class,"p-contextmenu-item")][contains(.,"${label}")]`)
    .waitForDisplayed({ timeout: 5_000, timeoutMsg: `context menu item "${label}" never appeared` });

/**
 * Click a context-menu item by label text.
 * PrimeNG 21's click handler lives on div.p-contextmenu-item-content, not on the li.
 * We dispatch the click there directly so the command fires.
 */
const clickMenuItem = async (label: string) =>
  browser.execute((text: string) => {
    const all = Array.from(document.querySelectorAll('.p-contextmenu-item-content'));
    const target = all.find(el => el.textContent?.includes(text));
    target?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, label);

/** Right-click a .worktree-entry by index and wait for the context menu to open. */
const openWorktreeMenu = async (index: number) => {
  await rightClickAt('.worktree-entry', index);
  await beat();
};

describe('Worktrees — list, create, remove', () => {
  before(async () => {
    await initRepoWithWorktrees(DEMO_BASE);
  });

  it('shows main and linked worktrees in the panel', async () => {
    // Main worktree always present
    await browser.waitUntil(
      async () => {
        const n = await browser.execute(() => document.querySelectorAll('.worktree-entry').length);
        return (n as number) >= 1;
      },
      { timeout: 20_000, timeoutMsg: 'no worktree entries appeared' },
    );
    await expect($('.worktree-entry i.fa-home')).toBeDisplayed();

    // Linked worktree created on disk before opening the repo
    await browser.waitUntil(
      async () => {
        const n = await browser.execute(() => document.querySelectorAll('.worktree-entry').length);
        return (n as number) >= 2;
      },
      { timeout: 10_000, timeoutMsg: 'linked worktree entry never appeared' },
    );
    await expect($('.worktree-entry i.fa-code-fork')).toBeDisplayed();
  });

  it('creates a worktree via the dialog', async () => {
    const countBefore = (await $$('.worktree-entry')).length;

    // Open dialog via the "+" icon in the Worktrees panel title
    await jsClick(await $('i[title="Add worktree"]'));
    await beat();
    await $('p-dialog').waitForDisplayed({ timeout: 5_000 });

    // Open the reference branch dropdown and select experiment/local-storage
    await jsClick(await $('p-dialog p-select'));
    await beat();
    await jsClick(
      await $('//li[contains(@class,"p-select-option")][contains(.,"experiment/local-storage")]'),
    );
    await beat();

    // Auto-fill overrides the branch name to avoid colliding with the existing branch
    const branchInput = await $('p-dialog input[placeholder="new-branch-name"]');
    await clearInput(branchInput);
    await typeInto(branchInput, 'wt/experiment');
    await beat();

    // workDir is auto-filled by refreshWorkDir(); submit
    await jsClick(await $('//p-button[@label="Create Worktree"]//button'));
    await see();
    await see(); // git worktree add + full refresh pipeline

    await browser.waitUntil(
      async () => (await $$('.worktree-entry')).length > countBefore,
      { timeout: 10_000, timeoutMsg: 'new worktree entry never appeared after create' },
    );
  });

  it('opens a linked worktree in a new tab on double-click', async () => {
    const tabsBefore = (await $$('p-tab')).length;

    // Double-click the first linked worktree entry (index 1 = feature/dark-mode)
    await browser.execute((sel: string, i: number) => {
      const el = document.querySelectorAll(sel)[i] as HTMLElement;
      el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    }, '.worktree-entry', 1);

    await browser.waitUntil(
      async () => (await $$('p-tab')).length > tabsBefore,
      { timeout: 15_000, timeoutMsg: 'new tab never appeared after worktree double-click' },
    );

    // Switch back to the first tab so subsequent tests operate on the main repo
    await jsClickAt('p-tab', 0);
    await browser.waitUntil(
      async () => (await $$('tr.commit-row')).length > 0,
      { timeout: 10_000, timeoutMsg: 'commit rows never appeared after switching back to main tab' },
    );
  });

  it('removes a worktree via context menu', async () => {
    const countBefore = (await $$('.worktree-entry')).length;
    const lastIndex = countBefore - 1;

    await openWorktreeMenu(lastIndex);
    await waitForMenuItem('Remove this worktree');
    await clickMenuItem('Remove this worktree');
    await see();
    await see(); // git worktree remove + refresh

    await browser.waitUntil(
      async () => (await $$('.worktree-entry')).length < countBefore,
      { timeout: 15_000, timeoutMsg: 'worktree count did not decrease after remove' },
    );
  });
});