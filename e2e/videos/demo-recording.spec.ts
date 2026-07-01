/**
 * Demo recording spec — driven by wdio.demo.conf.ts via e2e/record.sh
 *
 * Scene timeline (~38 s):
 *   0–4   s  app loads, commit graph settles
 *   4–8   s  annotate: full commit graph with branches
 *   8–15  s  click commit → Monaco diff, annotate diff editor
 *  15–20  s  click another commit → different diff
 *  20–26  s  right-click branch chip → context menu, annotate
 *  26–29  s  click index row → working directory
 *  29–36  s  click unstaged file → diff, annotate hunk staging
 *  36–38  s  fade out
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  DEMO_BASE,
  allByText,
  beat,
  copyRepo,
  jsClick,
  rightClickAt,
  see,
  waitForDiff,
} from '../utils/helpers.js';

// ── Annotation helpers ────────────────────────────────────────────────────────

async function injectAnnotations(): Promise<void> {
  const roughSrc = fs.readFileSync(
    path.resolve(__dirname, '../../node_modules/roughjs/bundled/rough.js'), 'utf8',
  );
  const engineSrc = fs.readFileSync(
    path.resolve(__dirname, '../utils/annotation-engine.js'), 'utf8',
  );
  // Inject via <script> tag so the UMD bundle sets window.rough in page scope.
  const inject = (code: string) =>
    browser.execute((src: string) => {
      const s = document.createElement('script');
      s.textContent = src;
      document.head.appendChild(s);
    }, code);
  await inject(roughSrc);
  await inject(engineSrc);
}

async function annotate(
  selector: string,
  text: string,
  side: 'right' | 'bottom' = 'right',
  ms = 3000,
): Promise<void> {
  const pt = await browser.execute((sel: string) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector);
  if (!pt) return;
  await browser.execute(
    (t: string, x: number, y: number, s: string) => (window as any).__annDraw?.(t, x, y, s),
    text, pt.x, pt.y, side,
  );
  await browser.pause(ms);
  await browser.execute(() => (window as any).__annClear?.());
}

/** Annotate pointing at the first element matching any of `selectors` (first that exists wins). */
async function annotateFirst(
  selectors: string[],
  text: string,
  side: 'right' | 'bottom' = 'right',
  ms = 3000,
): Promise<void> {
  const pt = await browser.execute((sels: string[]) => {
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width && r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
    return null;
  }, selectors);
  if (!pt) return;
  await browser.execute(
    (t: string, x: number, y: number, s: string) => (window as any).__annDraw?.(t, x, y, s),
    text, pt.x, pt.y, side,
  );
  await browser.pause(ms);
  await browser.execute(() => (window as any).__annClear?.());
}

// ── Spec ──────────────────────────────────────────────────────────────────────

describe('demo recording', () => {
  before(async () => {
    const repoDir = copyRepo(DEMO_BASE);

    await browser.execute(() => {
      localStorage.clear();
      localStorage.setItem('zoom', '1.1');
      localStorage.setItem('theme', 'dark');
    });
    await browser.refresh();

    // Welcome screen — wait for it to appear, then linger for 3 s so viewers see it
    await $('gitgud-welcome-screen p-button[label="Open"] button').waitForDisplayed({ timeout: 15_000 });
    await browser.pause(3000);

    await browser.execute((dir: string) => {
      (window as any).tauri.dialog.showOpenDialog = async () => [dir];
    }, repoDir);
    await jsClick(await $('gitgud-welcome-screen p-button[label="Open"] button'));

    await browser.waitUntil(
      async () => (await $$('tr.commit-row')).length > 0,
      { timeout: 40_000, timeoutMsg: 'commit rows never appeared' },
    );

    await injectAnnotations();
    // Let the graph render fully
    await browser.pause(3000);
  });

  it('records the full demo', async () => {
    // ── 1. Commit graph ───────────────────────────────────────────────────────
    await annotate('tr.commit-row:nth-child(3)', 'Your whole history at a glance\nBranches, tags & stashes', 'right', 3500);

    // ── 2. Click "dark mode" commit → Monaco diff ────────────────────────────
    const darkModeRow = await $('//tr[contains(@class,"commit-row") and contains(.,"dark mode CSS")]');
    if (await darkModeRow.isExisting()) {
      await jsClick(darkModeRow);
      await beat(1000);
      const styleFile = (await allByText('li', 'styles.css'))[0];
      if (styleFile) await jsClick(styleFile);
      await waitForDiff();
      await annotate('gitgud-monaco-editor-view', 'Rich diffs in the Monaco editor\nThe same engine as VS Code', 'bottom', 3500);
    }

    // ── 3. Click "implement add" commit ───────────────────────────────────────
    const implRow = await $('//tr[contains(@class,"commit-row") and contains(.,"implement add")]');
    if (await implRow.isExisting()) {
      await jsClick(implRow);
      await beat(800);
      const appFile = (await allByText('li', 'app.js'))[0];
      if (appFile) await jsClick(appFile);
      await waitForDiff();
      await see(2000);
    }

    // ── 4. Right-click branch chip → context menu ─────────────────────────────
    // Close the viewed file first (Esc) so the diff panel from scene 3 is dismissed
    await browser.execute(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })),
    );
    await beat(600);
    await browser.execute(() => {
      const scroller = document.querySelector('.p-datatable-table-container');
      if (scroller) scroller.scrollTop = 0;
    });
    await beat(500);
    if ((await $$('.draggable-chip')).length > 0) {
      await rightClickAt('.draggable-chip', 0);
      await beat(800);
      await annotate('.p-contextmenu', 'Right-click any branch\nRebase, merge or cherry-pick', 'right', 3000);
      await browser.execute(() =>
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })),
      );
      await beat(600);
    }

    // ── 5. Working directory with unstaged changes ────────────────────────────
    await jsClick(await $$('tr.commit-row').then(r => r[0]));
    await beat(1000);
    await annotate('.p-splitter-panel:first-child h4', 'Live working directory\nUpdates the moment you save', 'right', 3000);

    const unstagedFile = await $('//td[contains(.,"app.js")]');
    if (await unstagedFile.isExisting()) {
      await jsClick(unstagedFile);
      await waitForDiff();
      await beat(1000);

      // Put the cursor on the first real change (green line) and open the staging menu there
      const changedLine = await browser.execute(() => {
        const diffEd = (window as any).__e2eDiffEditor;
        const modEd = diffEd?.getModifiedEditor();
        const changes = diffEd?.getLineChanges?.() ?? [];
        const change = changes.find((c: any) => c.modifiedEndLineNumber > 0) ?? changes[0];
        if (!modEd || !change) return null;
        const line = change.modifiedStartLineNumber || change.modifiedEndLineNumber;
        modEd.focus();
        modEd.setPosition({ lineNumber: line, column: 1 });
        modEd.revealLineInCenter(line);
        return line as number;
      });
      await beat(700);
      // Show Monaco's context menu at the cursor (keyboard-anchored — works in WebKit)
      await browser.execute(() =>
        (window as any).__e2eDiffEditor?.getModifiedEditor()?.trigger('e2e', 'editor.action.showContextMenu', null),
      );
      await beat(700);
      // Point at the actual context menu, located by its "Stage this line" entry
      const menuPt = await browser.execute(() => {
        const leaf = Array.from(document.querySelectorAll('*'))
          .find(el => el.children.length === 0 && /Stage this line/i.test(el.textContent ?? ''));
        const menu = leaf?.closest('.monaco-menu, .monaco-menu-container, .context-view') ?? leaf?.parentElement;
        const el = menu ?? document.querySelector('gitgud-monaco-editor-view');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (menuPt) {
        await browser.execute(
          (t: string, x: number, y: number, s: string) => (window as any).__annDraw?.(t, x, y, s),
          'Stage line by line\nRight-click inside the diff', menuPt.x, menuPt.y, 'right',
        );
        await browser.pause(3500);
        await browser.execute(() => (window as any).__annClear?.());
      }

      // Stage that single line. Running the action also dismisses the context menu.
      // (Avoid dispatching Escape here — the editor closes the whole diff on Escape.)
      await browser.execute((line: number | null) => {
        const modEd = (window as any).__e2eDiffEditor?.getModifiedEditor();
        if (!modEd || !line) return;
        modEd.focus();
        modEd.setPosition({ lineNumber: line, column: 1 });
        modEd.trigger('e2e', 'stage-line', null);
      }, changedLine);
      // Wait for git + refresh to move the line into "Staged files" (staging closes the diff)
      await browser.waitUntil(async () => browser.execute(() =>
        Array.from(document.querySelectorAll('h4'))
          .some(h => /Staged files \([1-9]/.test(h.textContent ?? ''))
      ), { timeout: 8000, interval: 300 }).catch(() => {});
      await beat(800);

      // Re-open the staged diff: click the app.js row inside the "Staged files" panel
      await browser.execute(() => {
        const stagedH4 = Array.from(document.querySelectorAll('h4'))
          .find(h => h.textContent?.includes('Staged files'));
        const panel = stagedH4?.closest('.flex.flex-column');
        const row = panel && Array.from(panel.querySelectorAll('tr'))
          .find(tr => tr.textContent?.includes('app.js'));
        const target = (row?.querySelector('td') ?? row) as HTMLElement | undefined;
        if (!target) return;
        for (const type of ['mousedown', 'mouseup', 'click']) {
          target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
        }
      });
      const diffOpened = await $('gitgud-monaco-editor-view')
        .waitForDisplayed({ timeout: 4000 }).then(() => true, () => false);
      await beat(1000);

      // Annotate the reopened staged diff (fall back to the staged-files header if it didn't reopen)
      if (diffOpened)
        await annotate('gitgud-monaco-editor-view', 'That line is now staged\nCommit whenever you’re ready', 'bottom', 4000);
      else
        await annotateFirst(
          ['gitgud-make-a-commit', 'gitgud-monaco-editor-view'],
          'That line is now staged\nCommit whenever you’re ready', 'bottom', 4000,
        );
    }

    // ── 6. Final pause before fade-out (extra time on the last screen) ────────
    await browser.pause(2000);
  });
});
