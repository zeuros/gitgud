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

import {inject, Injectable} from '@angular/core';
import {auditTime, buffer, debounceTime, Subject} from 'rxjs';
import {createWatcher} from '../utils/file-watcher.utils';
import {type GitDirs, gitPath} from '../utils/git-path.utils';
import {GitApiService} from './git/git-api.service';

const GIT_DIR_STATE = ['HEAD', 'index', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'MERGE_HEAD'];
const COMMON_DIR_STATE = ['packed-refs', 'config', 'worktrees'];

@Injectable({
  providedIn: 'root',
})
export class FileWatcherService {

  private gitApi = inject(GitApiService);
  private watchers: ReturnType<typeof createWatcher>[] = [];
  private watchedPath?: string;
  private fileChangeSubject$ = new Subject<string>();
  private gitStateChangeSubject$ = new Subject<string>();

  onWorkingDirFileChange$ = this.fileChangeSubject$.pipe(auditTime(300));

  // Paths of git's state (HEAD, index, refs…) changed together, across the git dir and refs watchers
  onGitStateChange$ = this.gitStateChangeSubject$.pipe(buffer(this.gitStateChangeSubject$.pipe(debounceTime(100))));

  setWatcher = (projectPath: string) => {
    if (projectPath === this.watchedPath) return;
    this.watchedPath = projectPath;

    // Remove existing watchers if any
    this.watchers.forEach(watcher => watcher.close());

    // Watch a project's files changes, then git's state once its git dirs are known
    this.watchers = [this.makeWatcher(projectPath)];
    this.gitApi.gitDirs(projectPath)
      .then(dirs => projectPath === this.watchedPath && this.watchers.push(...this.makeGitStateWatchers(projectPath, dirs)))
      .catch(console.error);
  };

  private makeWatcher = (projectPath: string) =>
    // Ignored dirs and debouncing are handled in Rust (watcher.rs)
    createWatcher(projectPath, projectPath)
      .on('add', f => this.fileChangeSubject$.next(String(f)))
      .on('change', f => this.fileChangeSubject$.next(String(f)))
      .on('unlink', f => this.fileChangeSubject$.next(String(f)))
      .on('error', console.error);

  // The git dir and common dir entries the app shows (HEAD, index, operation in progress, packed-refs, upstreams in config, worktrees)
  // and every ref below refs/, lock files left out. FETCH_HEAD is left out: a fetch that moved something also wrote below refs/
  private makeGitStateWatchers = (projectPath: string, dirs: GitDirs) => {
    const gitStatePaths = new Set([
      ...GIT_DIR_STATE.map(name => gitPath(dirs, name)),
      ...COMMON_DIR_STATE.map(name => `${dirs.commonDir}/${name}`),
    ]);
    const isGitState = (path: string) => gitStatePaths.has(path) || (path.startsWith(`${dirs.commonDir}/refs/`) && !path.endsWith('.lock'));
    return [
      createWatcher(`${projectPath}:git-dirs`, [...new Set([dirs.gitDir, dirs.commonDir])], {recursive: false}),
      createWatcher(`${projectPath}:refs`, `${dirs.commonDir}/refs`, {ignored: []}),
    ].map(watcher => watcher
      .on('all', (_event, path) => isGitState(String(path)) && this.gitStateChangeSubject$.next(String(path)))
      .on('error', console.error));
  };

}
