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

import {Injectable} from '@angular/core';

export interface ConflictHunk {
  index: number;
  oursLines: string[];
  theirsLines: string[];
  /** resolved lines — undefined = not yet resolved */
  resolution?: string[];
}

export interface ParsedFile {
  hasConflicts: boolean;
  contextBlocks: string[][];
  hunks: ConflictHunk[];
}

@Injectable({providedIn: 'root'})
export class ConflictParserService {

  parse(content: string): ParsedFile {
    const lines = content.split('\n');
    const contextBlocks: string[][] = [];
    const hunks: ConflictHunk[] = [];

    let state: 'context' | 'ours' | 'theirs' = 'context';
    let currentContext: string[] = [];
    let currentOurs: string[] = [];
    let currentTheirs: string[] = [];

    for (const line of lines) {
      if (line.startsWith('<<<<<<<')) {
        contextBlocks.push(currentContext);
        currentContext = [];
        state = 'ours';
      } else if (line.startsWith('=======') && state === 'ours') {
        state = 'theirs';
      } else if (line.startsWith('>>>>>>>') && state === 'theirs') {
        hunks.push({index: hunks.length, oursLines: currentOurs, theirsLines: currentTheirs});
        currentOurs = [];
        currentTheirs = [];
        state = 'context';
      } else if (state === 'ours') {
        currentOurs.push(line);
      } else if (state === 'theirs') {
        currentTheirs.push(line);
      } else {
        currentContext.push(line);
      }
    }

    contextBlocks.push(currentContext);

    return {
      hasConflicts: hunks.length > 0,
      contextBlocks,
      hunks,
    };
  }

  static hasConflicts(content: string): boolean {
    return content.includes('<<<<<<<');
  }

  /** Rebuild file content from resolved ParsedFile */
  rebuild(parsed: ParsedFile): string {
    const parts: string[] = [];
    for (let i = 0; i < parsed.contextBlocks.length; i++) {
      parts.push(...parsed.contextBlocks[i]);
      if (i < parsed.hunks.length) {
        const hunk = parsed.hunks[i];
        const resolved = hunk.resolution ?? hunk.oursLines;
        parts.push(...resolved);
      }
    }
    return parts.join('\n');
  }
}
