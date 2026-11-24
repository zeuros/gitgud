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

import type {TranscriptChunk} from '../../typings';

// Claude Code's transcripts: <config dir>/projects/<cwd, each non-alphanumeric character as '-'>/<session id>.jsonl,
// read by `read_transcript` (Rust) in chunks of the lines added since the last one.

export type TranscriptEntry =
  | {kind: 'prompt'; text: string}
  | {kind: 'text'; text: string}
  | {kind: 'tool'; id: string; name: string; summary: string; result?: string; isError?: boolean};

export interface Transcript {
  title?: string;
  entries: TranscriptEntry[];
  /** Where the next chunk starts */
  nextByte: number;
}

export const EMPTY_TRANSCRIPT: Transcript = {entries: [], nextByte: 0};

export const claudeProjectDirName = (cwd: string) => cwd.replace(/[^a-zA-Z0-9]/g, '-');

/** The transcript with the chunk's lines added: a tool's result goes on its tool */
export const appendTranscriptChunk = (transcript: Transcript, {entries, title, nextByte, restarted}: TranscriptChunk): Transcript => {
  const previous = restarted ? EMPTY_TRANSCRIPT : transcript;
  const appended = [...previous.entries];
  for (const entry of entries) {
    if (entry.kind !== 'result') {
      appended.push(entry);
      continue;
    }
    // Results come soon after their tool: searched from the end
    for (let index = appended.length - 1; index >= 0; index--) {
      const tool = appended[index];
      if (tool.kind !== 'tool' || tool.id !== entry.toolId) continue;
      appended[index] = {...tool, result: entry.result, isError: entry.isError};
      break;
    }
  }
  return {title: title ?? previous.title, entries: appended, nextByte};
};
