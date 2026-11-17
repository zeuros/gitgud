// Captures the Flathub metainfo screenshots (docs/img/flathub-*.png): the app window at 1000×700, on the demo repo.
// Not a spec, so the e2e run skips it. Run it on a private Xvfb:
//   npm run e2e:setup && env -u WAYLAND_DISPLAY LIBGL_ALWAYS_SOFTWARE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 \
//     xvfb-run -a -s "-screen 0 1600x900x24 -ac +extension GLX +render" npx wdio run wdio.conf.ts --spec e2e/flathub-screenshots.ts
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { allByText, beat, DEMO_BASE, jsClick, see, waitForDiff } from './utils/helpers.js';

const WIDTH = 1000;
const HEIGHT = 700;

// The web view's own rendering: an X grab of the transparent window, without a compositor, misses unpainted areas
const capture = (name: string) => browser.saveScreenshot(`docs/img/flathub-${name}.png`);

/** Opens a copy of `template` named todo-app (the tab shows the folder's name), at zoom 80% to fit more in the window */
async function openRepo(template: string) {
  const repoDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gitgud-screenshots-')), 'todo-app');
  execSync(`cp -r "${template}" "${repoDir}"`);
  await browser.execute(() => {
    localStorage.clear();
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('zoom', '0.8');
  });
  await browser.refresh();
  const open = $('//gitgud-welcome-screen//button[normalize-space()="Open"]');
  await open.waitForDisplayed({ timeout: 15_000 });
  await browser.execute((dir: string) => {
    window.tauri.dialog.showOpenDialog = async () => [dir];
  }, repoDir);
  await jsClick(await open);
  await browser.waitUntil(async () => (await $$('tr.commit-row')).length > 0, { timeout: 40_000 });
  // The stored zoom only sets the toolbar's value: the web view's zoom is applied by setFactor
  await browser.execute(() => window.tauri.zoom.setFactor(0.8));
}

const commitRow = (subject: string) => $(`//tr[contains(@class,"commit-row") and contains(.,"${subject}")]`);

describe('Flathub screenshots', () => {
  before(async () => {
    await browser.setWindowRect(0, 0, WIDTH, HEIGHT);
  });

  it('log and branch graph', async () => {
    await openRepo(DEMO_BASE);
    await jsClick(await commitRow('theme toggle with localStorage'));
    await see(3000);
    await capture('1-log');
  });

  it('diff of a commit', async () => {
    await jsClick(await commitRow('dark mode CSS with custom properties'));
    await beat();
    await jsClick((await allByText('li', 'styles.css'))[0]);
    await waitForDiff();
    await see(3000);
    await capture('2-diff');
  });

  it('working directory changes', async () => {
    await jsClick((await $$('tr.commit-row'))[0]);
    await beat();
    await jsClick((await allByText('td', 'app.js'))[0]);
    await waitForDiff();
    await see(3000);
    await capture('3-changes');
  });
});
