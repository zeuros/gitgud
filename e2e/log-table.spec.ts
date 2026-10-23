import { execSync } from 'child_process';
import * as fs from 'fs';
import { initRepo, jsClick, pressKey, rightClick, tauriReload, typeInto } from './utils/helpers';

// The commit log table: virtual rendering, row selection, column sizing and context menu.
// Written against what the user sees (rows, selection, widths), not against the table component behind it.

const LONG_REPO = '/tmp/gitgud-demo-long';
const COMMITS = 300;

// A linear history long enough for the log to render only a window of its rows
const createLongRepo = () => {
  if (fs.existsSync(`${LONG_REPO}/.git`)) return;
  fs.mkdirSync(LONG_REPO, { recursive: true });
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Long Dev', GIT_AUTHOR_EMAIL: 'long@dev.test', GIT_COMMITTER_NAME: 'Long Dev', GIT_COMMITTER_EMAIL: 'long@dev.test' };
  execSync(`git init -q -b main "${LONG_REPO}"`, { env });
  const script = Array.from({ length: COMMITS }, (_, i) => `git -C "${LONG_REPO}" commit -q --allow-empty -m "commit ${i + 1}"`).join(' && ');
  execSync(script, { env, shell: '/bin/bash' });
};

const rows = () => $$('tr.commit-row');
const rowSummaries = () => browser.execute(() => [...document.querySelectorAll('tr.commit-row td.summary')].map(td => td.textContent?.trim() ?? ''));
const row = (summary: string) => $(`//tr[contains(@class,"commit-row")][td[contains(@class,"summary")][normalize-space()="${summary}"]]`);

// Selected shas as the app stores them, and the selected rows as rendered
const selectedShas = () => browser.execute(() => {
  const repos = JSON.parse(localStorage.getItem('GitRepositories') ?? '[]') as { selected: boolean; selectedCommitsShas: string[] }[];
  return repos.find(r => r.selected)?.selectedCommitsShas ?? [];
});
const selectedSummaries = () => browser.execute(() =>
  [...document.querySelectorAll('tr.commit-row')]
    .filter(tr => tr.getAttribute('aria-selected') === 'true')
    .map(tr => tr.querySelector('td.summary')?.textContent?.trim() ?? ''));

const clickRow = async (summary: string, modifiers: { ctrl?: boolean; shift?: boolean } = {}) => {
  const el = await row(summary);
  await el.waitForExist({ timeout: 10_000 });
  await browser.execute((e: Element, m: { ctrl?: boolean; shift?: boolean }) => {
    const td = e.querySelector('td.summary')!;
    td.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: !!m.ctrl, shiftKey: !!m.shift }));
  }, el, modifiers);
  await browser.pause(300);
};

const scrollLog = (top: number) => browser.execute((t: number) => {
  const scroller = document.querySelector('gitgud-logs .log-scroller') as HTMLElement;
  scroller.scrollTop = t === -1 ? scroller.scrollHeight : t;
  scroller.dispatchEvent(new Event('scroll'));
}, top);

const columns = () => browser.execute(() => {
  const scroller = document.querySelector('gitgud-logs .log-scroller') as HTMLElement;
  const ths = [...document.querySelectorAll('gitgud-logs thead th')] as HTMLElement[];
  return {
    container: scroller.clientWidth,
    widths: ths.map(th => th.getBoundingClientRect().width),
    minWidths: ths.map(th => parseFloat(getComputedStyle(th).minWidth) || 0),
  };
});

// Drags the resizer at the right edge of column `index` by dx pixels
const dragResizer = (index: number, dx: number) => browser.execute((i: number, d: number) => {
  const th = document.querySelectorAll('gitgud-logs thead th')[i];
  const resizer = th.querySelector('.column-resizer') as HTMLElement;
  const r = resizer.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const init = (cx: number): MouseEventInit => ({ bubbles: true, cancelable: true, clientX: cx, clientY: y, button: 0, buttons: 1 });
  resizer.dispatchEvent(new MouseEvent('mousedown', init(x)));
  document.dispatchEvent(new MouseEvent('mousemove', init(x + d / 2)));
  document.dispatchEvent(new MouseEvent('mousemove', init(x + d)));
  document.dispatchEvent(new MouseEvent('mouseup', init(x + d)));
}, index, dx);

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

describe('Log table', () => {
  before(async () => {
    createLongRepo();
    await initRepo(LONG_REPO);
    await row(`commit ${COMMITS}`).waitForExist({ timeout: 20_000 });
  });

  // Computed styles and a screenshot of the log, to compare two implementations (LOG_SNAPSHOT=<dir>)
  it('snapshots the log look', async () => {
    const dir = process.env['LOG_SNAPSHOT'];
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    await clickRow('commit 298');
    await browser.pause(500);
    const styles = await browser.execute(() => {
      const pick = (el: Element | null, props: string[]) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        return Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)]));
      };
      const box = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'height', 'font-size', 'font-weight', 'color',
        'background-color', 'border-top-width', 'border-bottom-width', 'border-top-color', 'line-height', 'vertical-align', 'text-align'];
      const rowsEls = [...document.querySelectorAll('tr.commit-row')];
      const selectedRow = rowsEls.find(tr => tr.textContent?.includes('commit 298'));
      const plainRow = rowsEls.find(tr => tr.textContent?.includes('commit 296'));
      return {
        thead: pick(document.querySelector('gitgud-logs thead'), ['position', 'top', 'z-index', 'background-color']),
        th: [...document.querySelectorAll('gitgud-logs thead th')].map(th => pick(th, box)),
        row: pick(plainRow ?? null, ['height', 'border-top-width', 'border-bottom-width', 'border-top-color', 'background-color', 'cursor']),
        tds: [...(plainRow?.querySelectorAll('td') ?? [])].map(td => pick(td, box)),
        selectedTds: [...(selectedRow?.querySelectorAll('td') ?? [])].map(td => pick(td, ['background-color', 'color'])),
        rowTops: rowsEls.slice(0, 6).map(tr => Math.round(tr.getBoundingClientRect().top)),
        layout: (() => {
          const rect = (el: Element | null) => {
            const r = el?.getBoundingClientRect();
            return r ? { left: Math.round(r.left), width: Math.round(r.width) } : null;
          };
          const scroller = document.querySelector('gitgud-logs .log-scroller');
          return {
            logs: rect(document.querySelector('gitgud-logs')),
            scroller: rect(scroller),
            scrollerClientWidth: (scroller as HTMLElement | null)?.clientWidth,
            columns: [...document.querySelectorAll('gitgud-logs thead th')].map(th => Math.round(th.getBoundingClientRect().width)),
            leftPanel: rect(document.querySelector('gitgud-left-panel')),
            window: { inner: window.innerWidth, screen: screen.width },
          };
        })(),
        canvas: (() => {
          const c = document.querySelector('.commit-graph-canvas-container') as HTMLElement | null;
          const r = c?.getBoundingClientRect();
          return r ? { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width) } : null;
        })(),
      };
    });
    fs.writeFileSync(`${dir}/styles.json`, JSON.stringify(styles, null, 2));
    execSync(`ffmpeg -loglevel error -y -f x11grab -i "${process.env['DISPLAY']}" -frames:v 1 "${dir}/log.png"`);
  });

  it('renders only a window of the rows, with a scroll height for all of them', async () => {
    const rendered = (await rows()).length;
    expect(rendered).toBeGreaterThan(10);
    expect(rendered).toBeLessThan(COMMITS / 2);

    const scrollHeight = await browser.execute(() =>
      (document.querySelector('gitgud-logs .log-scroller') as HTMLElement).scrollHeight);
    const rowHeight = await browser.execute(() => (document.querySelector('tr.commit-row') as HTMLElement).getBoundingClientRect().height);
    expect(scrollHeight).toBeGreaterThan(rowHeight * (COMMITS - 5));
  });

  it('renders the rows at the scroll position', async () => {
    await scrollLog(-1);
    await browser.waitUntil(async () => (await rowSummaries()).includes('commit 1'), { timeout: 5_000, timeoutMsg: 'last commit never rendered after scrolling down' });
    expect(await rowSummaries()).not.toContain(`commit ${COMMITS}`);

    await scrollLog(0);
    await browser.waitUntil(async () => (await rowSummaries()).includes(`commit ${COMMITS}`), { timeout: 5_000, timeoutMsg: 'first commit never rendered after scrolling up' });
  });

  it('selects one row on click', async () => {
    await clickRow('commit 297');
    expect(await selectedSummaries()).toEqual(['commit 297']);
    expect(await selectedShas()).toHaveLength(1);
  });

  it('toggles rows with ctrl+click', async () => {
    await clickRow('commit 295', { ctrl: true });
    expect((await selectedSummaries()).sort()).toEqual(['commit 295', 'commit 297']);
    await clickRow('commit 295', { ctrl: true });
    expect(await selectedSummaries()).toEqual(['commit 297']);
  });

  it('selects a range with shift+click', async () => {
    await clickRow('commit 297');
    await clickRow('commit 292', { shift: true });
    expect((await selectedSummaries()).sort()).toEqual(['commit 292', 'commit 293', 'commit 294', 'commit 295', 'commit 296', 'commit 297']);
    expect(await selectedShas()).toHaveLength(6);
  });

  it('a plain click after a range selects that row only', async () => {
    await clickRow('commit 290');
    expect(await selectedSummaries()).toEqual(['commit 290']);
  });

  it('keeps a selection made far down the log', async () => {
    await scrollLog(-1);
    await row('commit 3').waitForExist({ timeout: 5_000 });
    await clickRow('commit 3');
    await clickRow('commit 1', { shift: true });
    expect((await selectedSummaries()).sort()).toEqual(['commit 1', 'commit 2', 'commit 3']);
    await scrollLog(0);
  });

  it('moves the selection with the arrow keys, extending it with shift', async () => {
    await clickRow('commit 299');
    await browser.execute(() => (document.querySelector('gitgud-logs .log-scroller') as HTMLElement).focus());
    await pressKey('ArrowDown');
    await browser.pause(200);
    expect(await selectedSummaries()).toEqual(['commit 298']);
    await pressKey('ArrowDown', { shift: true });
    await pressKey('ArrowDown', { shift: true });
    await browser.pause(200);
    expect((await selectedSummaries()).sort()).toEqual(['commit 296', 'commit 297', 'commit 298']);
    await pressKey('ArrowUp');
    await browser.pause(200);
    expect(await selectedSummaries()).toEqual(['commit 297']);
  });

  it('jumps to the last commit with End, scrolling to it, and back with Home', async () => {
    await pressKey('End');
    await row('commit 1').waitForExist({ timeout: 5_000 });
    await browser.waitUntil(async () => (await selectedSummaries()).includes('commit 1'), { timeout: 5_000, timeoutMsg: 'End never selected the last commit' });
    await pressKey('Home');
    await row(`commit ${COMMITS}`).waitForExist({ timeout: 5_000 });
    await browser.waitUntil(async () => (await selectedSummaries()).includes(`commit ${COMMITS}`), { timeout: 5_000, timeoutMsg: 'Home never selected the first commit' });
  });

  it('selects every commit with ctrl+A', async () => {
    await pressKey('a', { ctrl: true });
    await browser.pause(300);
    expect(await selectedShas()).toHaveLength(COMMITS);
    await clickRow(`commit ${COMMITS}`);
  });

  it('search jumps to and selects the matching commit', async () => {
    await pressKey('f', { ctrl: true });
    const search = await $('gitgud-search-logs input[name="search"]');
    await search.waitForExist();
    await typeInto(search, 'commit 150');
    await browser.pause(400);
    await pressKey('Enter');
    await row('commit 150').waitForExist({ timeout: 5_000 });
    await browser.waitUntil(async () => (await selectedSummaries()).includes('commit 150'), { timeout: 5_000, timeoutMsg: 'search never selected its match' });
    await pressKey('Escape');
    await scrollLog(0);
  });

  it('opens the commit context menu on right click', async () => {
    await row('commit 299').waitForExist({ timeout: 5_000 });
    await rightClick(await (await row('commit 299')).$('td.summary'));
    const menu = await $('.p-contextmenu');
    await menu.waitForExist({ timeout: 5_000 });
    expect(await menu.getText()).toContain('Revert');
    await pressKey('Escape');
    await jsClick(await $('body'));
    await browser.pause(300);
  });

  it('fills the panel width with the columns, never below their min-width', async () => {
    const { container, widths, minWidths } = await columns();
    expect(widths).toHaveLength(5);
    expect(Math.abs(sum(widths) - container)).toBeLessThan(3);
    widths.forEach((w, i) => expect(w).toBeGreaterThanOrEqual(minWidths[i] - 1));
  });

  it('keeps filling the width when the window shrinks or grows', async () => {
    const { width, height } = await browser.getWindowSize();
    await browser.setWindowSize(Math.round(width * 0.8), height);
    await browser.pause(600);
    let { container, widths } = await columns();
    expect(Math.abs(sum(widths) - container)).toBeLessThan(3);

    await browser.setWindowSize(width, height);
    await browser.pause(600);
    ({ container, widths } = await columns());
    expect(Math.abs(sum(widths) - container)).toBeLessThan(3);
  });

  it('resizes a column by dragging its edge, the next one gives the width', async () => {
    const before = (await columns()).widths;
    await dragResizer(0, 60);
    await browser.pause(400);
    const after = (await columns()).widths;
    expect(after[0] - before[0]).toBeGreaterThan(40);
    expect(before[1] - after[1]).toBeGreaterThan(40);
    expect(Math.abs(sum(after) - sum(before))).toBeLessThan(3);
  });

  it('stops a resize at the next column min-width', async () => {
    await dragResizer(1, 2000);
    await browser.pause(400);
    const { widths, minWidths, container } = await columns();
    expect(widths[2]).toBeGreaterThanOrEqual(minWidths[2] - 1);
    expect(Math.abs(sum(widths) - container)).toBeLessThan(3);
  });

  it('remembers resized widths after a reload', async () => {
    await dragResizer(0, -40);
    await browser.pause(400);
    const before = (await columns()).widths;
    await tauriReload();
    await browser.pause(1500);
    const after = (await columns()).widths;
    after.forEach((w, i) => expect(Math.abs(w - before[i])).toBeLessThan(4));
  });
});
