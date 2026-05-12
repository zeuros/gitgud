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
import {debounceTime, Subject} from 'rxjs';
import {createWatcher} from '../utils/file-watcher.utils';

@Injectable({
  providedIn: 'root',
})
export class FileWatcherService {

  private watcher?: ReturnType<typeof createWatcher>;
  private fileChangeSubject$ = new Subject<string>();

  onWorkingDirFileChange$ = this.fileChangeSubject$.pipe(debounceTime(50));

  setWatcher = (projectPath: string) => {

    // Remove existing watcher if any
    this.watcher?.close();

    // Watch a project's files changes
    this.watcher = this.makeWatcher(projectPath);
  };

  private makeWatcher = (projectPath: string) =>
    createWatcher(projectPath, projectPath, {
      ignored: [
        // Regex-based ignore (more reliable than globs (for Winsh**).
        // Ignores common tool/IDE directories and temp files:
        //   - .git (e.g. .git/FETCH_HEAD)
        //   - .idea/workspace.xml
        //   - node_modules, dist, build, tmp
        //   - editor/temp files: *.swp, *.swo, *~
        // Matches full path segments and supports both / and \ separators.
        /(^|[\/\\])(\.git|\.idea\/workspace\.xml|node_modules|dist|build|cache|tmp)([\/\\]|$)|\.swp$|\.swo$|~$/,
        '**/~*', // Ignore temporary files (e.g., ~ files from editors)
        '**/.DS_Store', // Ignore macOS system files
      ],
      followSymlinks: false,
      persistent: true,
      ignoreInitial: true, // Skip the initial "add" event for all files
      depth: 99, // Watch all subdirectories
      ignorePermissionErrors: true,
      awaitWriteFinish: {
        stabilityThreshold: 100, // Wait 100ms for file stability
        pollInterval: 100,
      },
    })
      .on('add', f => this.fileChangeSubject$.next(String(f)))
      .on('change', f => this.fileChangeSubject$.next(String(f)))
      .on('unlink', f => this.fileChangeSubject$.next(String(f)))
      .on('error', console.error);

}
