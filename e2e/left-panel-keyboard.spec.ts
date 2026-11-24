import { DEMO_BASE, initRepo, pressKey, waitForMenuItem } from './utils/helpers.js';

// The left panel's branch trees, driven from the keyboard.
// Local branches of the demo repository: experiment/local-storage, feature/dark-mode, main, prototype/canvas-ui

const localTree = () => $('gitgud-tree-list');
const rowLabels = () => browser.execute(() =>
  [...document.querySelector('gitgud-tree-list')!.querySelectorAll('.tree-list-row')].map(row => row.textContent?.trim() ?? ''));
const focusedLabel = () => browser.execute(() =>
  document.querySelector('gitgud-tree-list .tree-list-row.focused')?.textContent?.trim());
const selectedCommitSummary = () => browser.execute(() =>
  document.querySelector('tr.commit-row[aria-selected="true"] td.summary')?.textContent?.trim());

describe('left panel keyboard', () => {
  before(async () => {
    await initRepo(DEMO_BASE);
    await localTree().waitForExist();
    await browser.execute(() => (document.querySelector('gitgud-tree-list') as HTMLElement).focus());
  });

  it('moves the focus between rows', async () => {
    await pressKey('Home');
    expect(await focusedLabel()).toBe('experiment');
    await pressKey('ArrowDown');
    await pressKey('ArrowDown');
    expect(await focusedLabel()).toBe('feature');
    await pressKey('ArrowUp');
    expect(await focusedLabel()).toBe('local-storage');
  });

  it('collapses a folder with Left from its child, then expands it with Right', async () => {
    await pressKey('ArrowLeft'); // to the parent
    expect(await focusedLabel()).toBe('experiment');
    await pressKey('ArrowLeft'); // collapses it
    expect(await rowLabels()).not.toContain('local-storage');
    await pressKey('ArrowRight'); // expands it
    expect(await rowLabels()).toContain('local-storage');
    await pressKey('ArrowRight'); // to its first child
    expect(await focusedLabel()).toBe('local-storage');
  });

  it('selects the focused branch with Enter, its tip in the log', async () => {
    await pressKey('Enter');
    await browser.waitUntil(async () => (await selectedCommitSummary()) === 'experiment: add clear storage function',
      { timeout: 5_000, timeoutMsg: 'Enter did not select the branch tip in the log' });
    expect(await browser.execute(() =>
      document.querySelector('gitgud-tree-list .tree-list-row.selected')?.textContent?.trim())).toBe('local-storage');
  });

  it('opens the focused branch context menu with shift+F10', async () => {
    await pressKey('F10', { shift: true });
    await waitForMenuItem('Rebase main onto experiment/local-storage');
    await pressKey('Escape');
  });

  it('runs the focused branch menu shortcuts, the focus moved off the selected one', async () => {
    await browser.execute(() => (document.querySelector('gitgud-tree-list') as HTMLElement).focus());
    await pressKey('ArrowDown');
    expect(await focusedLabel()).toBe('feature');
    await pressKey('ArrowDown');
    expect(await focusedLabel()).toBe('dark-mode');
    await pressKey('b'); // Create branch here
    await $('input.branch-name-input').waitForDisplayed({ timeout: 5_000, timeoutMsg: 'B on the focused branch never opened the branch input' });
    expect(await selectedCommitSummary()).toBe('experiment: add clear storage function');
  });
});
