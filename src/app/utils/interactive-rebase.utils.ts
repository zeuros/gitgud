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

export type RebaseAction = 'pick' | 'reword' | 'squash' | 'fixup' | 'drop';

export interface RebaseEntry {
  sha: string;
  author: string;
  message: string; // Full message, edited by the user when action is reword
  action: RebaseAction;
}

const FIELD = '\x1f';
const RECORD = '\x1e';

export const REBASE_LOG_FORMAT = `--format=%H${FIELD}%an${FIELD}%B${RECORD}`;

// Parses `git log REBASE_LOG_FORMAT` (newest first, like the log panel)
export const parseRebaseLog = (output: string): RebaseEntry[] =>
  output.split(RECORD)
    .map(record => record.replace(/^\n+/, ''))
    .filter(record => record.length)
    .map(record => {
      const [sha, author, message] = record.split(FIELD);
      return {sha, author, message: message.trim(), action: 'pick'};
    });

export const summary = (message: string) => message.split('\n')[0];

const melds = ({action}: RebaseEntry) => action == 'squash' || action == 'fixup';

/** Why these entries (newest first) can't be rebased as is, undefined when they can */
export const invalidRebaseReason = (entries: RebaseEntry[]) => {
  const oldestKept = entries.filter(e => e.action != 'drop').at(-1);
  if (oldestKept && melds(oldestKept)) return 'The oldest commit has no commit below to be squashed into';
  if (entries.some(e => e.action == 'reword' && !e.message.trim())) return 'A reworded commit needs a message';
  return undefined;
};

export const rewordMessageFile = (sha: string) => `.git/gitgud-reword-${sha}`;

/** git-rebase-todo lines (oldest first) for these entries (newest first) */
export const buildRebaseTodo = (entries: RebaseEntry[]) =>
  [...entries].reverse().flatMap(({sha, action}) =>
    action == 'reword'
      // git's own reword opens an editor: amend from a message file instead
      ? [`pick ${sha}`, `exec git commit --amend -F ${rewordMessageFile(sha)} && rm ${rewordMessageFile(sha)}`]
      : [`${action} ${sha}`],
  );
