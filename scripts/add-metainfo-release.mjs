#!/usr/bin/env node
/*
 * Adds a <release> to the AppStream metainfo files, so software centers show the release notes.
 * The notes are the feat / fix commits since the previous tag. Does nothing if the release is already listed.
 *
 * Usage: node scripts/add-metainfo-release.mjs [version]   (defaults to $npm_new_version, then package.json)
 */

import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';

const FILES = [
  'src-tauri/linux/io.github.zeuros.gitgud.metainfo.xml',
  'build/flatpak/io.github.zeuros.gitgud.metainfo.xml',
];
const MAX_NOTES = 15;

const version = process.argv[2] ?? process.env.npm_new_version ?? JSON.parse(readFileSync('package.json', 'utf8')).version;
const tag = `v${version}`;

const git = (...args) => {
  try {
    return execFileSync('git', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
  } catch {
    return '';
  }
};

const escapeXml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 'feat(undo): undo stash actions' => 'Undo stash actions'
const toNote = subject => {
  const text = subject.replace(/^\w+(\([^)]*\))?!?:\s*/, '');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const releaseNotes = () => {
  const end = git('rev-parse', '-q', '--verify', `refs/tags/${tag}`) ? tag : 'HEAD';
  const previous = git('describe', '--tags', '--abbrev=0', '--match', 'v*', `${end}^`);
  if (!previous) return [];
  const subjects = git('log', '--no-merges', '--format=%s', `${previous}..${end}`).split('\n');
  return [/^feat(\(|:|!)/, /^fix(\(|:|!)/]
    .flatMap(type => subjects.filter(s => type.test(s)))
    .slice(0, MAX_NOTES)
    .map(toNote);
};

const releaseXml = () => {
  const date = git('log', '-1', '--format=%cs', tag) || new Date().toISOString().slice(0, 10);
  const notes = releaseNotes();
  const description = notes.length
    ? `<p>What's new in GitGud ${version}:</p>\n        <ul>\n${notes.map(n => `          <li>${escapeXml(n)}</li>`).join('\n')}\n        </ul>`
    : `<p>Bug fixes and improvements.</p>`;
  return `    <release version="${version}" date="${date}">\n      <description>\n        ${description}\n      </description>\n    </release>\n`;
};

let release;
for (const file of FILES) {
  const xml = readFileSync(file, 'utf8');
  if (xml.includes(`<release version="${version}"`)) continue;
  release ??= releaseXml();
  // Newest release first
  writeFileSync(file, xml.replace(/<releases>\s*\n/, match => match + release));
  console.log(`Added release ${version} to ${file}`);
}
