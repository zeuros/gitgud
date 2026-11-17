// Shared setup of the Quests recordings (the website's course), recorded one by one by e2e/videos/quests/record.sh
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { beat, clickMenuItem, copyRepo, jsClick, rightClick, typeInto, waitForMenuItem } from '../../utils/helpers.js';
import { annotateAt, centerOfXPath, injectAnnotations } from '../../utils/annotations.js';

// Zoomed in so the UI stays readable in the website's smaller video frames
const RECORDING_ZOOM = '1.4';

export interface FixtureRepo {
  repoDir: string;
  git: (...args: string[]) => string;
  write: (files: Record<string, string>) => void;
  commit: (subject: string, files?: Record<string, string>) => void;
}

export function fixtureRepo(repoDir: string): FixtureRepo {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8', stdio: 'pipe' }).trimEnd();
  const write = (files: Record<string, string>) => {
    for (const [name, contents] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(repoDir, name)), { recursive: true });
      fs.writeFileSync(path.join(repoDir, name), contents);
    }
  };
  const commit = (subject: string, files: Record<string, string> = {}) => {
    write(files);
    git('add', '-A');
    git('commit', '-q', '-m', subject);
  };
  return { repoDir, git, write, commit };
}

/** Creates `/tmp/gitgud-quest-<name>` from scratch on `main`, then lets `build` write its history */
export function createFixture(name: string, build: (repo: FixtureRepo) => void): string {
  const templateDir = `/tmp/gitgud-quest-${name}`;
  fs.rmSync(templateDir, { recursive: true, force: true });
  fs.mkdirSync(templateDir);
  const repo = fixtureRepo(templateDir);
  repo.git('init', '-q', '-b', 'main');
  repo.git('config', 'user.name', 'Ada Lovelace');
  repo.git('config', 'user.email', 'ada@gitgud.dev');
  build(repo);
  return templateDir;
}

/**
 * Opens a copy of `templateDir` in a fresh app, zoomed for the recording, with the annotations installed. `prepare`
 * runs on the copy before the app opens it
 */
export async function openQuestRepo(templateDir: string, prepare?: (repo: FixtureRepo) => void): Promise<FixtureRepo> {
  const repoDir = copyRepo(templateDir);
  prepare?.(fixtureRepo(repoDir));
  await browser.execute((zoom: string) => {
    localStorage.clear();
    localStorage.setItem('zoom', zoom);
    localStorage.setItem('theme', 'dark');
  }, RECORDING_ZOOM);
  await browser.refresh();

  const openButton = $('//gitgud-welcome-screen//button[normalize-space()="Open"]');
  await openButton.waitForDisplayed({ timeout: 15_000 });
  await browser.execute((dir: string) => {
    window.tauri.dialog.showOpenDialog = async () => [dir];
  }, repoDir);
  await jsClick(await openButton);
  await browser.waitUntil(async () => (await $$('tr.commit-row')).length > 0,
    { timeout: 40_000, timeoutMsg: 'commit rows never appeared' });

  await injectAnnotations();
  // Let the graph and the panels settle before the scene starts
  await beat(2500);
  return fixtureRepo(repoDir);
}

/** Records when the scene starts and ends, record.sh cuts the video to it */
export function markScene(event: 'start' | 'end'): void {
  const marksFile = process.env['QUEST_MARKS_FILE'];
  if (marksFile) fs.appendFileSync(marksFile, `${event} ${Date.now() / 1000}\n`);
}

export const commitRow = (subject: string) => $(commitRowXPath(subject));

export const commitRowXPath = (subject: string) => `//tr[contains(@class,"commit-row")][contains(.,"${subject}")]`;

/** Types `text` a few characters at a time, as someone typing */
export async function typeSlowly(input: WebdriverIO.Element, text: string): Promise<void> {
  for (const chunk of text.match(/.{1,4}/g) ?? []) {
    await typeInto(input, chunk);
    await beat(90);
  }
}

export const branchChip = (name: string) =>
  `//div[contains(@class,"draggable-chip")][.//*[normalize-space()="${name}"]]`;

/**
 * Drags the log's chip of branch `sourceName` onto the chip of `targetName`, moving the drag preview in steps so the
 * viewer follows it. Synthetic mouse events, as the WebDriver Actions API isn't available; the CDK ignores a mousedown
 * without `buttons` or `detail` (it takes it for a screen reader's)
 */
export async function dragBranchChip(sourceName: string, targetName: string): Promise<void> {
  const sourceXPath = branchChip(sourceName);
  const targetXPath = branchChip(targetName);
  const steps = 24;
  await browser.execute((source: string, target: string, stepCount: number) => {
    const find = (xpath: string) =>
      document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement | null;
    const sourceChip = find(source);
    const targetChip = find(target);
    if (!sourceChip || !targetChip) return;
    const from = sourceChip.getBoundingClientRect();
    const to = targetChip.getBoundingClientRect();
    const start = { x: from.left + 12, y: from.top + from.height / 2 };
    const end = { x: to.left + to.width / 2, y: to.top + to.height / 2 };
    const mouse = (type: string, x: number, y: number, element: EventTarget, buttons = 1) =>
      element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons, detail: 1 }));

    mouse('mousedown', start.x, start.y, sourceChip);
    let step = 0;
    const move = () => {
      step++;
      const x = start.x + (end.x - start.x) * step / stepCount;
      const y = start.y + (end.y - start.y) * step / stepCount;
      mouse('mousemove', x, y, document);
      if (step < stepCount) return void setTimeout(move, 40);
      // The drop zone learns it's hovered from pointerenter, which synthetic mouse moves don't fire
      const dropZone = targetChip.closest('.log-chip-drop-zone') ?? targetChip;
      dropZone.dispatchEvent(new PointerEvent('pointerenter', { clientX: x, clientY: y }));
      mouse('mousemove', x + 1, y, document);
      setTimeout(() => mouse('mouseup', x + 1, y, document, 0), 400);
    };
    setTimeout(move, 40);
  }, sourceXPath, targetXPath, steps);
  await browser.pause(steps * 40 + 900);
}

/** The potion shop's first commits, which most quests start from */
export function openShop(repo: FixtureRepo): void {
  repo.commit('chore: open the potion shop', {
    'README.md': '# Potion shop\n\nSells potions to adventurers.\n',
    'shop.js': "export const potions = ['health'];\n\nexport const price = name => 10;\n",
  });
  repo.commit('docs: opening hours', {
    'README.md': '# Potion shop\n\nSells potions to adventurers.\n\nOpen from dawn to dusk.\n',
  });
}

/** Opens the context menu of the log row whose message contains `subject`, then clicks `label` in it */
export async function commitMenu(subject: string, label: string, note?: string): Promise<void> {
  await rightClick(await commitRow(subject));
  await waitForMenuItem(label);
  await beat(500);
  if (note) await annotateAt(await centerOfXPath(menuItemXPath(label)), note, 'right', 2200);
  await clickMenuItem(label);
}

/** Opens the context menu of the log chip of branch `name`, then clicks `label` in it */
export async function branchChipMenu(name: string, label: string, note?: string): Promise<void> {
  await rightClick(await $(branchChip(name)));
  await waitForMenuItem(label);
  await beat(500);
  if (note) await annotateAt(await centerOfXPath(menuItemXPath(label)), note, 'right', 2200);
  await clickMenuItem(label);
}

export const menuItemXPath = (label: string) => `//li[contains(@class,"p-contextmenu-item")][contains(.,"${label}")]`;

export const chipPoint = (name: string) => centerOfXPath(branchChip(name));

/** Waits for the toast reporting a finished action */
export const waitForToast = (text: string) =>
  $(`//*[contains(@class,"p-toast-message")][contains(.,"${text}")]`).waitForExist({ timeout: 20_000, timeoutMsg: `the "${text}" toast never showed` });

/** Clicks `label` in the open context menu, then waits for the toast of the action it ran */
export async function clickAndWait(label: string, toast: string): Promise<void> {
  await clickMenuItem(label);
  await waitForToast(toast);
}
