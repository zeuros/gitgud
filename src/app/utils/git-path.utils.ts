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

// In a linked worktree `.git` is a file: its state (HEAD, index, rebase-merge…) lives in <main>/.git/worktrees/<name>,
// while refs are shared with the main repository. `gitDir` is the former, `commonDir` the latter (equal outside worktrees)
export interface GitDirs {
  gitDir: string;
  commonDir: string;
}

// Same split as `git rev-parse --git-path`: refs (but the per-worktree ones), packed-refs and their logs are shared
const SHARED = /^(refs\/(?!bisect|worktree|rewritten)|packed-refs$|logs\/refs\/)/;

/** Absolute path of `name` (e.g. 'rebase-merge', 'refs/stash') in the repository's git directory */
export const gitPath = ({gitDir, commonDir}: GitDirs, name: string) => `${SHARED.test(name) ? commonDir : gitDir}/${name}`;

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** Rebase todo line amending the current commit with the message in `file`, then deleting it */
export const amendFromFile = (file: string) => `exec git commit --amend -F ${shellQuote(file)} && rm ${shellQuote(file)}`;
