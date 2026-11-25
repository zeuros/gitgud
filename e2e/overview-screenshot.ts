// Captures the website's hero screenshot (docs/img/overview.png): the app window at 1920×1080, zoom 120%, on the demo repo.
// Not a spec, so the e2e run skips it. Run it on a private Xvfb:
//   npm run e2e:setup && env -u WAYLAND_DISPLAY LIBGL_ALWAYS_SOFTWARE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 \
//     xvfb-run -a -s "-screen 0 1920x1080x24 -ac +extension GLX +render" npx wdio run wdio.conf.ts --spec e2e/overview-screenshot.ts
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DEMO_BASE, jsClick, see } from './utils/helpers.js';

const WIDTH = 1920;
const HEIGHT = 1080;
const ZOOM = 1.2;

describe('Website overview screenshot', () => {
  before(async () => {
    await browser.setWindowRect(0, 0, WIDTH, HEIGHT);
  });

  it('log and branch graph', async () => {
    const repoDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gitgud-screenshots-')), 'todo-app');
    execSync(`cp -r "${DEMO_BASE}" "${repoDir}"`);
    await browser.execute((zoom: number) => {
      localStorage.clear();
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('zoom', String(zoom));
    }, ZOOM);
    await browser.refresh();

    const open = $('//gitgud-welcome-screen//button[normalize-space()="Open"]');
    await open.waitForDisplayed({ timeout: 15_000 });
    await browser.execute((dir: string) => {
      window.tauri.dialog.showOpenDialog = async () => [dir];
    }, repoDir);
    await jsClick(await open);
    await browser.waitUntil(async () => (await $$('tr.commit-row')).length > 0, { timeout: 40_000 });
    // The stored zoom only sets the toolbar's value: the web view's zoom is applied by setFactor
    await browser.execute((zoom: number) => window.tauri.zoom.setFactor(zoom), ZOOM);

    await jsClick(await $('//tr[contains(@class,"commit-row") and contains(.,"theme toggle with localStorage")]'));
    await see(3000);
    await browser.saveScreenshot('docs/img/overview.png');
  });
});
