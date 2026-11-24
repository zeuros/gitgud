import { execFileSync } from 'child_process';
import { DEMO_BASE, initRepo, jsClick, pressKey, rightClick, waitForMenuItem } from './utils/helpers.js';

// Context menus underline a letter per item, typed to run it; items' shortcuts run them from the focused log
describe('menu shortcuts', () => {
  let repoDir: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trimEnd();
  const row = (summary: string) => $(`//tr[contains(@class,"commit-row")][contains(.,"${summary}")]`);
  const focusLog = () => browser.execute(() => (document.querySelector('gitgud-logs .log-scroller') as HTMLElement).focus());
  const menuShown = () => browser.execute(() => !!document.querySelector('.p-contextmenu'));
  const branchInput = () => $('input.branch-name-input');

  before(async () => {
    repoDir = await initRepo(DEMO_BASE);
    await row('refactor: extract sanitize helper').waitForDisplayed({ timeout: 15_000 });
  });

  it('underlines each item\'s letter, distinct in the menu, and shows the shortcuts', async () => {
    await rightClick(await row('refactor: extract sanitize helper'));
    await waitForMenuItem('Create branch here');
    const items = await browser.execute(() => Array.from(document.querySelectorAll('.p-contextmenu-root-list > .p-contextmenu-item'))
      .map(item => ({
        label: item.querySelector(':scope > .p-contextmenu-item-content .p-contextmenu-item-label')?.textContent?.trim(),
        mnemonic: item.querySelector(':scope > .p-contextmenu-item-content .menu-mnemonic')?.textContent,
        shortcut: item.querySelector(':scope > .p-contextmenu-item-content .menu-shortcut')?.textContent,
      })));
    const branch = items.find(item => item.label == 'Create branch here');
    expect(branch).toEqual({ label: 'Create branch here', mnemonic: 'b', shortcut: 'B' });
    const mnemonics = items.map(item => item.mnemonic?.toLowerCase()).filter(Boolean);
    expect(new Set(mnemonics).size).toBe(mnemonics.length);
    await pressKey('Escape');
  });

  it('runs the item whose letter is typed in the open menu', async () => {
    await rightClick(await row('refactor: extract sanitize helper'));
    await waitForMenuItem('Create branch here');
    await pressKey('b');
    await branchInput().waitForDisplayed({ timeout: 5_000, timeoutMsg: 'B in the menu never opened the branch input' });
    await browser.waitUntil(async () => !(await menuShown()), { timeout: 5_000, timeoutMsg: 'the menu stayed open' });
    await pressKey('Escape');
  });

  it('opens a submenu with its letter, then runs its item', async () => {
    const head = git('rev-parse', 'HEAD');
    await rightClick(await row('refactor: extract sanitize helper'));
    await waitForMenuItem('Create branch here');
    await pressKey('r');
    await waitForMenuItem('Soft');
    await pressKey('s');
    await browser.waitUntil(async () => git('rev-parse', 'HEAD') != head, { timeout: 10_000, timeoutMsg: 'R then S never soft reset' });
    expect(git('log', '-1', '--format=%s')).toBe('refactor: extract sanitize helper');
    git('reset', '--soft', head);
  });

  it('runs the selected commit\'s shortcut from the focused log, and opens its menu with Shift+F10', async () => {
    await jsClick(await row('feat: add responsive breakpoint'));
    await focusLog();
    await pressKey('b');
    await branchInput().waitForDisplayed({ timeout: 5_000, timeoutMsg: 'B on the log never opened the branch input' });
    await pressKey('Escape');

    await focusLog();
    await pressKey('F10', { shift: true });
    await waitForMenuItem('Create tag here');
    await pressKey('Escape');
  });
});
