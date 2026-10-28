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

import {effect, type EffectCleanupFn, inject, Injectable} from '@angular/core';
import {auditTime, buffer, Subject} from 'rxjs';
import {createWatcher, watchErrorMessage} from '../utils/file-watcher.utils';
import type {GitDirs} from '../utils/git-path.utils';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {GitApiService} from './git/git-api.service';
import {ToastService} from './toast.service';
import type {WatchError} from '../../typings';

// Git's state is watched apart. node_modules is skipped even when git doesn't ignore it: it can exhaust the watch limit. Generic
// names (build, dist, cache…) are left to the ignore rules: they may be source folders
const WORKING_TREE_IGNORED_DIRS = ['.git', 'node_modules'];
// Git's own storage, which the app doesn't show. Anchored: refs/heads/feature/hooks is a branch
const COMMON_DIR_IGNORED_DIRS = ['/objects', '/logs', '/lfs', '/modules', '/hooks'];

@Injectable({
  providedIn: 'root',
})
export class FileWatcherService {

  private gitApi = inject(GitApiService);
  private currentRepo = inject(CurrentRepoStore);
  private toast = inject(ToastService);
  private fileChangeSubject$ = new Subject<string>();
  private gitStateChangeSubject$ = new Subject<string>();

  // Debouncing is handled in Rust (watcher.rs)
  onWorkingDirFileChange$ = this.fileChangeSubject$.pipe(auditTime(0)); // Paths are batched and emitted once

  // The paths of git's state (HEAD, index, refs…) changed in one Rust batch
  onGitStateChange$ = this.gitStateChangeSubject$.pipe(buffer(this.gitStateChangeSubject$.pipe(auditTime(0))));

  constructor() {
    // Watches the selected worktree, the clean-up closing its watchers when switching to another
    effect(onCleanup => {
      const cwd = this.currentRepo.cwd();
      if (cwd) onCleanup(this.watchProjectFilesChanges(cwd));
    });
  }

  // Watches a project's files, then git's state once its git dirs are known; the cleanup closes what this call opened
  private watchProjectFilesChanges = (projectPath: string): EffectCleanupFn => {
    let stopped = false;
    // Told once per worktree opened, whichever of its watchers failed first
    let errorShown = false;
    const showWatchError = (error: unknown) => {
      console.error(error);
      if (errorShown || stopped) return;
      errorShown = true;
      this.toast.err(watchErrorMessage(projectPath, error as WatchError), {sticky: true});
    };
    const watchers = [this.makeFilesWatcher(projectPath, showWatchError)];
    // The cleanup may run before gitDirs answers: don't open watchers nobody would close
    this.gitApi.gitDirs(projectPath)
      .then(dirs => !stopped && watchers.push(this.makeGitStateWatcher(projectPath, dirs, showWatchError)))
      .catch(console.error);
    return () => {
      stopped = true;
      watchers.forEach(watcher => watcher.close());
    };
  };

  private makeFilesWatcher = (projectPath: string, onError: (error: unknown) => void) =>
    createWatcher(projectPath, projectPath, {ignoredDirs: WORKING_TREE_IGNORED_DIRS, respectGitIgnore: true})
      .on('add', f => this.fileChangeSubject$.next(String(f)))
      .on('change', f => this.fileChangeSubject$.next(String(f)))
      .on('unlink', f => this.fileChangeSubject$.next(String(f)))
      .on('error', onError);

  // The common dir holds the refs and each linked worktree's git dir (worktrees/<name>).
  // Lock files left out: they are renamed to the file they lock, which fires too
  private makeGitStateWatcher = (projectPath: string, {commonDir}: GitDirs, onError: (error: unknown) => void) =>
    createWatcher(`${projectPath}:git`, commonDir, {ignoredDirs: COMMON_DIR_IGNORED_DIRS})
      .on('all', (_event, path) => String(path).endsWith('.lock') || this.gitStateChangeSubject$.next(String(path)))
      .on('error', onError);

}
