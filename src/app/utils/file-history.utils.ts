/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {AppFileStatusKind, type AppFileStatus} from '../lib/github-desktop/model/status';

export interface FileHistoryEntry {
  sha: string;
  author: string;
  date: Date;
  summary: string;
  path: string; // The file's path in that commit (it may have been renamed since)
  status: AppFileStatus;
}

const FIELD = '\x1f';
const RECORD = '\x1e';

export const FILE_HISTORY_ARGS = ['log', '--follow', '--name-status', `--format=${RECORD}%H${FIELD}%an${FIELD}%aI${FIELD}%s`];

const toStatus = (letter: string, oldPath: string): AppFileStatus => {
  switch (letter[0]) {
    case 'A': return {kind: AppFileStatusKind.New};
    case 'D': return {kind: AppFileStatusKind.Deleted};
    case 'R': return {kind: AppFileStatusKind.Renamed, oldPath};
    case 'C': return {kind: AppFileStatusKind.Copied, oldPath};
    default: return {kind: AppFileStatusKind.Modified};
  }
};

// Parses `git FILE_HISTORY_ARGS <rev> -- <path>`: a header line per commit, followed by the file's name-status line
export const parseFileHistory = (output: string): FileHistoryEntry[] =>
  output.split(RECORD)
    .filter(record => record.trim().length)
    .flatMap(record => {
      const [header, ...rest] = record.split('\n');
      const nameStatus = rest.find(line => line.length);
      if (!nameStatus) return [];
      const [sha, author, date, summary] = header.split(FIELD);
      const [letter, ...paths] = nameStatus.split('\t');
      return [{sha, author, date: new Date(date), summary, path: paths.at(-1)!, status: toStatus(letter, paths[0])}];
    });

export interface BlameCommit {
  sha: string;
  author: string;
  date: Date;
  summary: string;
  path: string; // The file's path in that commit
  committed: boolean; // false for lines not committed yet
}

export interface Blame {
  lines: {sha: string, text: string}[];
  commits: Map<string, BlameCommit>;
}

const blameHeaderRe = /^([0-9a-f]{40}) \d+ \d+/;

// Parses `git blame --porcelain`: a "<sha> <orig line> <line> [<count>]" header per line, the commit's details
// the first time it shows up, then the line itself after a tab
export const parseBlame = (output: string): Blame => {
  const blame: Blame = {lines: [], commits: new Map()};
  let sha = '';

  for (const line of output.split('\n')) {
    if (line.startsWith('\t')) {
      blame.lines.push({sha, text: line.slice(1)});
      continue;
    }

    const header = blameHeaderRe.exec(line);
    if (header) {
      sha = header[1];
      if (!blame.commits.has(sha))
        blame.commits.set(sha, {sha, author: '', date: new Date(0), summary: '', path: '', committed: !/^0+$/.test(sha)});
      continue;
    }

    const commit = blame.commits.get(sha);
    if (!commit) continue;
    const space = line.indexOf(' ');
    const [key, value] = [line.slice(0, space), line.slice(space + 1)];
    if (key == 'author') commit.author = value;
    else if (key == 'author-time') commit.date = new Date(+value * 1000);
    else if (key == 'summary') commit.summary = value;
    else if (key == 'filename') commit.path = value;
  }

  return blame;
};

/** Whether this line starts a run of lines from the same commit */
export const startsBlameBlock = ({lines}: Blame, index: number) => index == 0 || lines[index - 1].sha != lines[index].sha;
