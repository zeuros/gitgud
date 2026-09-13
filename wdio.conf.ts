import { spawn } from 'child_process';
import { waitTauriDriverReady } from '@crabnebula/tauri-driver';
import type { Options } from '@wdio/types';
import path from 'path';
import os from 'os';

const BINARY = path.resolve(
  __dirname,
  'src-tauri/target/release',
  os.platform() === 'win32' ? 'gitgud.exe' : 'gitgud',
);

let tauriDriver: ReturnType<typeof spawn> | undefined;

const debug = !!process.env['WDIO_DEBUG'];

// Node.js v24+ ships a built-in undici that is incompatible with how the
// webdriverio npm package bundles its own undici (Headers/fetch mismatch).
// This flag makes webdriverio use Node's native fetch instead.
process.env['WDIO_USE_NATIVE_FETCH'] = '1';

// Force X11 backend so the Tauri app doesn't try Wayland under Xvfb and crash
// with "Error 71 (Protocol error) dispatching to Wayland display".
process.env['GDK_BACKEND'] = 'x11';

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./e2e/**/*.spec.ts'],
  exclude: ['./e2e/videos/**'],
  maxInstances: 1,

  hostname: '127.0.0.1',
  port: 4444,
  path: '/',

  capabilities: [{
    maxInstances: 1,
    'tauri:options': { application: BINARY },
  }],

  logLevel: 'warn',
  bail: 0,
  waitforTimeout: 10_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 3,

  framework: 'mocha',
  reporters: ['spec'],

  mochaOpts: {
    ui: 'bdd',
    // Large timeout in debug mode so the browser.debug() REPL never expires.
    // 0 causes wdio-mocha to compute (0 - 3) = -3ms which Node clamps to 1ms.
    timeout: debug ? 10 * 60 * 60 * 1000 : 60_000,
  },

  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      project: './e2e/tsconfig.json',
      transpileOnly: true,
    },
  },

  beforeSession: async () => {
    tauriDriver = spawn(
      path.resolve(__dirname, 'node_modules/.bin/tauri-driver'),
      [],
      { stdio: [null, process.stdout, process.stderr] },
    );
    await waitTauriDriverReady(tauriDriver);
  },

  afterSession: () => {
    tauriDriver?.kill();
  },

  // In debug mode: pause after every test (pass or fail) so you can inspect
  // the live Tauri window. Type WebdriverIO commands in the REPL, then .exit
  // to continue to the next test.
  afterTest: debug
    ? async (_test, _ctx, { error }) => {
        if (error) {
          console.log('\n[debug] Test FAILED ↑  —  inspect the window, then type  .exit  to continue\n');
        } else {
          console.log('\n[debug] Test passed  —  inspect the window, then type  .exit  to continue\n');
        }
        await browser.debug();
      }
    : undefined,
};
