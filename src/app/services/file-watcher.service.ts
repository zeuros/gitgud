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
import {auditTime, Subject} from 'rxjs';
import {createWatcher} from '../utils/file-watcher.utils';

@Injectable({
  providedIn: 'root',
})
export class FileWatcherService {

  private watcher?: ReturnType<typeof createWatcher>;
  private watchedPath?: string;
  private fileChangeSubject$ = new Subject<string>();

  onWorkingDirFileChange$ = this.fileChangeSubject$.pipe(auditTime(300));

  setWatcher = (projectPath: string) => {
    if (projectPath === this.watchedPath) return;
    this.watchedPath = projectPath;

    // Remove existing watcher if any
    this.watcher?.close();

    // Watch a project's files changes
    this.watcher = this.makeWatcher(projectPath);
  };

  private makeWatcher = (projectPath: string) =>
    // Ignored dirs and debouncing are handled in Rust (watcher.rs)
    createWatcher(projectPath, projectPath)
      .on('add', f => this.fileChangeSubject$.next(String(f)))
      .on('change', f => this.fileChangeSubject$.next(String(f)))
      .on('unlink', f => this.fileChangeSubject$.next(String(f)))
      .on('error', console.error);

}
