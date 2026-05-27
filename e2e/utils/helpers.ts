import {_electron as electron, type ElectronApplication, type Page} from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {execSync} from 'child_process';
import {setupAnnotations} from './annotateWithArrowAndText';

const BINARY = path.join(__dirname, '../../dist/linux-unpacked/gitgud');
const VIDEO_DIR = path.join(__dirname, '../recordings');

export const DEMO_BASE = '/tmp/gitgud-demo-base';
export const DEMO_CONFLICT = '/tmp/gitgud-demo-conflict';

// ── App launch ────────────────────────────────────────────────────────────────

export async function launchWithRepo(
  template: string,
  options: { record?: boolean } = {},
): Promise<{ app: ElectronApplication; page: Page; repoDir: string }> {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitgud-e2e-'));
  execSync(`cp -r ${template}/. ${repoDir}`);
  execSync(`chmod -R u+w "${repoDir}/.git"`); // cp preserves source permissions; .git/index may be read-only

  const app = await electron.launch({
    executablePath: BINARY,
    args: ['--no-sandbox', '--disable-gpu', '--ozone-platform=x11'],
    ...(options.record ? {recordVideo: {dir: VIDEO_DIR, size: {width: 1920, height: 1080}}} : {}),
  } as Parameters<typeof electron.launch>[0]);

  // The app shows a splash window first, which auto-closes once the main window
  // is ready.  Poll until exactly one non-closed window remains (= main window).
  const page = await new Promise<Page>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for main window')), 10_000);
    const check = setInterval(() => {
      const alive = app.windows().filter(w => !w.isClosed());
      if (alive.length === 1) {
        clearInterval(check);
        clearTimeout(timeout);
        resolve(alive[0]);
      }
    }, 300);
  });

  await app.evaluate(({BrowserWindow}, rec) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    // setContentSize pins the viewport to exactly the recording canvas size — avoids gray padding
    if (rec) win.setContentSize(1920, 1080);
    else win.maximize();
  }, options.record ?? false);
  // waitForLoadState misses events that fired before Playwright attached to the window;
  // waitForFunction polls the live DOM so it works regardless of when we got the page ref.
  await page.waitForFunction(() => document.readyState !== 'loading', {timeout: 10_000});

  // Seed localStorage so Angular routes straight to /repo (bypasses file dialog)
  const repoName = path.basename(repoDir);
  await page.evaluate(([dir, name]) => {
    localStorage.clear();
    localStorage.setItem('zoom', '1.1');
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('GitRepositories', JSON.stringify([{
      id: dir,
      name: name,
      selected: true,
      logs: [], stashes: [], tags: [], remoteTags: [], branches: [],
      selectedCommitsShas: ['index'],
      startCommit: 0,
      remotes: [],
      editorConfig: {viewType: 'split'},
      workDirStatus: {unstaged: [], staged: [], conflicted: []},
    }]));
  }, [repoDir, repoName] as [string, string]);

  await electronReload(app, page);
  // waitForFunction polls the live DOM — survives Angular bootstrapping after readyState fires
  await page.waitForFunction(
    () => document.querySelectorAll('tr.commit-row').length > 0,
    {timeout: 40_000},
  );

  return {app, page, repoDir};
}

// ── App utilities ─────────────────────────────────────────────────────────────

/** Reload via Electron's webContents.reload() instead of page.reload().
 *  page.reload() sends a raw CDP command that bypasses Electron's file:// interception. */
export async function electronReload(app: ElectronApplication, page: Page): Promise<void> {
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0]?.webContents.reload());
  // 'complete' (not 'interactive') ensures scripts have run before we poll for Angular content
  await page.waitForFunction(() => document.readyState === 'complete', {timeout: 10_000});
  // Annotation scripts are wiped on reload — re-inject so arrows work for the rest of the test
  await setupAnnotations(page);
}

// ── Timing helpers ─────────────────────────────────────────────────────────────

/** Pause so the viewer can see a result before the next action. */
export const see = (page: Page, ms = 1200) => page.waitForTimeout(ms);
/** Short beat between consecutive clicks / inputs. */
export const beat = (page: Page, ms = 400) => page.waitForTimeout(ms);

// ── Common interactions ────────────────────────────────────────────────────────

/** Click a toolbar button by its Font Awesome icon class. */
export const toolbarBtn = (page: Page, faClass: string) =>
  page.locator(`.actions button:has(i.${faClass})`).click();

/** Add a second repo tab and switch back — shows the tab switching feature. */
export async function demoSecondTab(page: Page, secondRepoPath: string) {
  // Click the "+" tab button
  await page.locator('p-tablist p-button:has(i.pi-plus)').click();
  await beat(page);
  // The file dialog is mocked by evaluating localStorage directly
  await page.evaluate((dir) => {
    const repos = JSON.parse(localStorage.getItem('GitRepositories') ?? '[]');
    repos.push({
      id: dir, name: dir.split('/').filter(Boolean).at(-1) ?? dir,
      selected: false, logs: [], stashes: [], tags: [], remoteTags: [], branches: [],
      selectedCommitsShas: ['index'], startCommit: 0, remotes: [],
      editorConfig: {viewType: 'split'}, workDirStatus: {unstaged: [], staged: [], conflicted: []},
    });
    localStorage.setItem('GitRepositories', JSON.stringify(repos));
    window.dispatchEvent(new StorageEvent('storage', {key: 'GitRepositories'}));
  }, secondRepoPath);
}

/** Wait for the Monaco diff editor to appear. */
export const waitForDiff = (page: Page) =>
  page.waitForSelector('gitgud-monaco-editor-view', {timeout: 10_000});

/** Wait for the merge editor overlay to appear. */
export const waitForMerge = (page: Page) =>
  page.waitForSelector('gitgud-merge-editor', {timeout: 10_000});

/**
 * Resolve every file in the "Conflicted files" list:
 *   1. Click each file row to open the three-way merge editor
 *   2. Click all visible merge-hunk buttons to accept hunks
 *   3. Click "Save & Mark Resolved" until the list is empty
 */
export async function resolveAllConflicts(page: Page): Promise<void> {
  // The conflicted-section lives in the commit detail panel — make sure the
  // WIP/index row is selected so the panel is visible before we start looping.
  await page.locator('tr.commit-row').first().click();
  await page.waitForTimeout(400);

  while (true) {
    const conflictRow = page.locator('.conflicted-section tr').first();
    if (!await conflictRow.isVisible({timeout: 2_000}).catch(() => false)) break;

    await conflictRow.click();
    await waitForMerge(page);

    // Click first merge-hunk button — for hunks with two choices this picks
    // whichever was rendered last (THEIRS/RHS), which is fine for demo purposes.
    const buttons = page.locator('button.msm__merge-button');
    await buttons.nth(0).click();
    await page.waitForTimeout(80);

    await page.getByRole('button', {name: 'Save & Mark Resolved'}).click();
    // Wait for the editor to close before moving to the next file
    await page.waitForSelector('gitgud-merge-editor', {state: 'hidden', timeout: 10_000});
    await page.waitForTimeout(400);
  }
}
