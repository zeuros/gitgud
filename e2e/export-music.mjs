#!/usr/bin/env node
// Renders the Strudel tune e2e/music.html to e2e/music.wav in a headless Firefox, for e2e/record.sh
//
// Usage: node e2e/export-music.mjs

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { remote } from 'webdriverio';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const wavPath = path.join(e2eDir, 'music.wav');

const browser = await remote({
  logLevel: 'warn',
  capabilities: { browserName: 'firefox', 'moz:firefoxOptions': { args: ['-headless'] } },
});
try {
  await browser.url(pathToFileURL(path.join(e2eDir, 'music.html')).href);
  // Loading the samples and soundfonts, then rendering, takes a while
  await browser.setTimeout({ script: 300_000 });
  const wavBase64 = await browser.executeAsync((done) => {
    window.renderWav({ download: false })
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = () => done(String(reader.result).split(',')[1]);
        reader.readAsDataURL(blob);
      })
      .catch((error) => done({ error: String(error) }));
  });
  if (typeof wavBase64 !== 'string') throw new Error(`rendering failed: ${wavBase64?.error}`);
  writeFileSync(wavPath, Buffer.from(wavBase64, 'base64'));
  console.log(`[export-music] wrote ${wavPath}`);
} finally {
  await browser.deleteSession();
}
