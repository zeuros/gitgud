import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

export const DEMO_BASE = '/tmp/gitgud-demo-base';
export const DEMO_CONFLICT = '/tmp/gitgud-demo-conflict';

// ── XPath helpers (WebKitWebDriver only accepts CSS or XPath natively) ────────

export const byText = (tag: string, text: string) =>
  $(`//${tag}[contains(.,"${text}")]`);

export const allByText = (tag: string, text: string) =>
  $$(`//${tag}[contains(.,"${text}")]`);

// ── Interaction helpers — all via browser.execute; WebKitWebDriver does not  ──
// ── support the Actions API, element/click, or element/value endpoints.      ──

export const jsClick = async (el: WebdriverIO.Element) =>
  browser.execute(
    (e: Element) => e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
    el,
  );

export const rightClick = async (el: WebdriverIO.Element) =>
  browser.execute(
    (e: Element) => e.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })),
    el,
  );

/** Click by CSS selector index — avoids stale-ref on elements that re-render (e.g. Monaco lines).
 *  Dispatches the full mousedown+mouseup+click sequence so Monaco registers cursor position. */
export const jsClickAt = async (css: string, index = 0) =>
  browser.execute((sel: string, i: number) => {
    const el = document.querySelectorAll(sel)[i] as HTMLElement | undefined;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const opts: MouseEventInit = { bubbles: true, cancelable: true, clientX: x, clientY: y };
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  }, css, index);

/** Right-click by CSS selector index — dispatches full mousedown+mouseup+contextmenu sequence. */
export const rightClickAt = async (css: string, index = 0) =>
  browser.execute((sel: string, i: number) => {
    const el = document.querySelectorAll(sel)[i] as HTMLElement | undefined;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const base: MouseEventInit = { bubbles: true, cancelable: true, clientX: x, clientY: y };
    el.dispatchEvent(new MouseEvent('mousedown', { ...base, button: 2, buttons: 2 }));
    el.dispatchEvent(new MouseEvent('mouseup', { ...base, button: 2, buttons: 2 }));
    el.dispatchEvent(new MouseEvent('contextmenu', { ...base, button: 2, buttons: 2 }));
  }, css, index);

export const focus = async (el: WebdriverIO.Element) =>
  browser.execute((e: HTMLElement) => e.focus(), el);

/** Type text into an input/textarea without using the WebDriver value endpoint. */
export const typeInto = async (el: WebdriverIO.Element, text: string) =>
  browser.execute((e: HTMLInputElement | HTMLTextAreaElement, t: string) => {
    e.focus();
    e.value += t;
    e.dispatchEvent(new InputEvent('input', { bubbles: true, data: t }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
  }, el, text);

/** Clear an input/textarea without using the WebDriver value endpoint. */
export const clearInput = async (el: WebdriverIO.Element) =>
  browser.execute((e: HTMLInputElement | HTMLTextAreaElement) => {
    e.focus();
    e.value = '';
    e.dispatchEvent(new InputEvent('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
  }, el);

/** Send a key event to the currently focused element (bypasses the Actions API).
 *  `code` is auto-derived: single letters → 'KeyX', digits → 'DigitN', others pass through as-is. */
export const pressKey = async (key: string, modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) =>
  browser.execute((k: string, m: { ctrl?: boolean; shift?: boolean; alt?: boolean }) => {
    const code = k.length === 1 && /[a-z]/i.test(k)
      ? `Key${k.toUpperCase()}`
      : k.length === 1 && /[0-9]/.test(k)
        ? `Digit${k}`
        : k;
    const target = (document.activeElement as HTMLElement | null) ?? document.body;
    const init: KeyboardEventInit = {
      key: k, code, bubbles: true, cancelable: true,
      ctrlKey: !!m.ctrl, shiftKey: !!m.shift, altKey: !!m.alt,
    };
    target.dispatchEvent(new KeyboardEvent('keydown', init));
    target.dispatchEvent(new KeyboardEvent('keyup', init));
  }, key, modifiers);

// ── Timing helpers ────────────────────────────────────────────────────────────

export const beat = (ms = 400) => browser.pause(ms);
export const see = (ms = 1200) => browser.pause(ms);

// ── Repo helpers ──────────────────────────────────────────────────────────────

function copyRepo(template: string): string {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitgud-e2e-'));
  execSync(`cp -r "${template}/." "${repoDir}"`);
  execSync(`chmod -R u+w "${repoDir}/.git"`);
  return repoDir;
}

export async function initRepo(template: string): Promise<void> {
  const repoDir = copyRepo(template);

  // Clear any stale state from a previous run, then reload so Angular starts fresh.
  await browser.execute(() => {
    localStorage.clear();
    localStorage.setItem('zoom', '1.1');
    localStorage.setItem('theme', 'dark');
  });
  await browser.refresh();

  await $('gitgud-welcome-screen p-button[label="Open"] button').waitForDisplayed({ timeout: 15_000 });

  await browser.execute((dir: string) => {
    (window as any).tauri.dialog.showOpenDialog = async () => [dir];
  }, repoDir);

  await jsClick(await $('gitgud-welcome-screen p-button[label="Open"] button'));

  await browser.waitUntil(
    async () => (await $$('tr.commit-row')).length > 0,
    { timeout: 40_000, timeoutMsg: 'commit rows never appeared after initRepo' },
  );
}

/** Add a second repo through the UI (the + button) without reloading the app. */
export async function addRepoViaUI(template: string): Promise<void> {
  const repoDir = copyRepo(template);
  await browser.execute((dir: string) => {
    (window as any).tauri.dialog.showOpenDialog = async () => [dir];
  }, repoDir);
  await jsClick(await $('//p-button[@icon="pi pi-plus"]//button'));
  // Wait for the new tab to appear (more tabs than before)
  await browser.waitUntil(
    async () => (await $$('p-tab')).length > 1,
    { timeout: 15_000, timeoutMsg: 'new repo tab never appeared after addRepoViaUI' },
  );
}

export async function addRepo(template: string): Promise<void> {
  const repoDir = copyRepo(template);

  await browser.execute((dir: string) => {
    const repos = JSON.parse(localStorage.getItem('GitRepositories') ?? '[]');
    repos.push({
      id: dir,
      name: dir.split('/').filter(Boolean).at(-1) ?? dir,
      selected: false,
      logs: [], stashes: [], tags: [], remoteTags: [], branches: [],
      selectedCommitsShas: ['index'], startCommit: 0, remotes: [],
      editorConfig: { viewType: 'split' },
      workDirStatus: { unstaged: [], staged: [], conflicted: [] },
    });
    localStorage.setItem('GitRepositories', JSON.stringify(repos));
    window.dispatchEvent(new StorageEvent('storage', { key: 'GitRepositories' }));
  }, repoDir);
}

// ── App utilities ─────────────────────────────────────────────────────────────

export async function tauriReload(): Promise<void> {
  // Navigate to root so Tauri always serves index.html (avoid SPA-path 404s on refresh)
  await browser.execute(() => { window.location.href = window.location.origin + '/'; });
  // Wait until commit rows render from the cached localStorage repos
  await browser.waitUntil(
    async () => (await browser.execute(() => document.querySelectorAll('tr.commit-row').length)) > 0,
    { timeout: 15_000, timeoutMsg: 'commit rows never appeared after tauriReload' },
  );
}

export const waitForDiff = () =>
  $('gitgud-monaco-editor-view').waitForDisplayed({ timeout: 10_000 });

export const waitForMerge = () =>
  $('gitgud-merge-editor').waitForDisplayed({ timeout: 10_000 });
