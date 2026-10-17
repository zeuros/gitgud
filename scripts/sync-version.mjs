#!/usr/bin/env node
/*
 * Stamps the app version into the files npm doesn't manage: the Tauri config, Cargo.toml, and the
 * website's version badge and download links (which embed the version in the release asset names).
 *
 * Usage: node scripts/sync-version.mjs [version]   (defaults to $npm_new_version, then package.json)
 */

import {readFileSync, writeFileSync} from 'node:fs';

const version = process.argv[2] ?? process.env.npm_new_version ?? JSON.parse(readFileSync('package.json', 'utf8')).version;

// Each file's current version is found by a pattern, then every occurrence of it is replaced
const FILES = [
  {file: 'src-tauri/Cargo.toml', current: /^version = "([^"]+)"/m},
  {file: 'src-tauri/tauri.conf.json', current: /"version": "([^"]+)"/},
  {file: 'docs/index.html', current: /releases\/download\/v([^/]+)\//},
];

for (const {file, current} of FILES) {
  const text = readFileSync(file, 'utf8');
  const old = text.match(current)?.[1];
  if (!old) throw new Error(`No version found in ${file}`);
  if (old === version) continue;
  // The website repeats its version in every link; the config files also hold dependency versions, so only the matched one is ours
  writeFileSync(file, file.endsWith('.html') ? text.replaceAll(old, version) : text.replace(current, m => m.replace(old, version)));
  console.log(`${file}: ${old} → ${version}`);
}
