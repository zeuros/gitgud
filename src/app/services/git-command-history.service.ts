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

import {Injectable, signal} from '@angular/core';

export interface GitCommandRecord {
  args: string[];
  cwd?: string;
  timestamp: Date;
  success: boolean;
}

@Injectable({providedIn: 'root'})
export class GitCommandHistoryService {
  history = signal<GitCommandRecord[]>([]);

  record(args: string[], cwd?: string, success = true) {
    this.history.update(h => [{args, cwd, timestamp: new Date(), success}, ...h].slice(0, 500));
  }
}
