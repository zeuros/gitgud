#!/usr/bin/env node
const { spawn } = require('child_process');
const { readdirSync, existsSync } = require('fs');
const { join } = require('path');

const dist = join(__dirname, '..', 'dist');

const binary = {
  win32:  () => join(dist, 'win-unpacked', 'GitGud.exe'),
  darwin: () => { const d = readdirSync(dist).find(e => e.startsWith('mac')); return d && join(dist, d, 'GitGud.app', 'Contents', 'MacOS', 'GitGud'); },
  linux:  () => { const d = readdirSync(dist).find(e => e.includes('unpacked')); return d && join(dist, d, 'gitgud'); },
}[process.platform]?.();

if (!binary || !existsSync(binary)) {
  console.error('Binary not found. Run npm run build:prod first.');
  process.exit(1);
}

spawn(binary, [], { stdio: 'inherit', detached: true }).unref();
