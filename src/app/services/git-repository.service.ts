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

import {effect, inject, Injectable} from '@angular/core';
import {concatMap, EMPTY, from, Observable, switchMap} from 'rxjs';
import {ConfirmationService} from 'primeng/api';
import {isRootDirectory} from '../utils/utils';
import {createRepository} from '../utils/repository-utils';
import {FileWatcherService} from './file-watcher.service';
import {GitRepositoryStore} from '../stores/git-repos.store';
import {GitRefreshService} from './git-refresh.service';
import {GitApiService} from './git/git-api.service';
import {mainWorktreeOf, withoutTrailingSlash} from '../utils/worktree-utils';
import {CurrentRepoStore} from '../stores/current-repo.store';

@Injectable({
  providedIn: 'root',
})
export class GitRepositoryService {

  private fileWatcher = inject(FileWatcherService);
  private gitRepositoryStore = inject(GitRepositoryStore);
  private gitRefresh = inject(GitRefreshService);
  private gitApi = inject(GitApiService);
  private currentRepo = inject(CurrentRepoStore);
  private confirmation = inject(ConfirmationService);

  constructor() {
    effect(() => {
      const cwd = this.currentRepo.cwd();
      if (cwd) this.fileWatcher.setWatcher(cwd);
    });
    window.tauri.onPathsDropped(this.openDroppedRepositories);
  }

  // Opens the repository of each folder dropped on the window, one after the other
  private openDroppedRepositories = (paths: string[]) => {
    from(paths).pipe(concatMap(this.openFolder)).subscribe();
  };

  // Opens the repository `path` is in, or offers to create one in its folder
  private openFolder = (path: string) =>
    from(this.folderOf(path)).pipe(switchMap(folder => from(this.findGitDir(folder)).pipe(
      switchMap(repoPath => repoPath ? this.openRepository(repoPath) : this.confirmInitRepository(folder)),
    )));

  private folderOf = async (path: string) =>
    await window.tauri.fs.isFile(path).catch(() => false) ? window.tauri.path.dirname(path) : path;

  private confirmInitRepository = (folder: string) => new Observable<unknown>(subscriber => {
    this.confirmation.confirm({
      header: 'Not a git repository',
      message: `${folder} isn't in a git repository. Create one there?`,
      acceptLabel: 'Init',
      rejectLabel: 'Cancel',
      accept: () => this.initAndOpenRepository(folder).subscribe(subscriber),
      reject: () => subscriber.complete(),
    });
  });

  private initAndOpenRepository = (folder: string) =>
    this.gitApi.init(folder).pipe(switchMap(() => this.openRepository(folder)));

  // The main worktree when `path` is a linked worktree, undefined otherwise (or when it isn't a repository)
  private findMainWorktree = (path: string) =>
    this.gitApi.gitDirs(path).then(dirs => mainWorktreeOf(dirs, path), () => undefined);

  /** Makes the current tab work in the worktree at `path` (the main worktree or a linked one): git runs there from now on */
  switchWorktree = (path: string) => {
    this.gitRepositoryStore.updateSelectedRepository({activeWorktree: path === this.currentRepo.id() ? undefined : path});
    return this.gitRefresh.refreshAll();
  };

  pickFolderAndOpenRepository = () => {
    from(window.tauri.dialog.showOpenDialog({properties: ['openDirectory']})).pipe(
      switchMap(picked => picked?.length ? this.openFolder(picked[0]) : EMPTY),
    ).subscribe();
  };

  /**
   * Opens or retrieve repository after user picks a repo folder
   * - Reuses an existing repo if already opened
   * - For a linked worktree's folder, opens its repository and works in that worktree
   * - Marks it as selected
   * - Refreshes logs, branches, and stashes
   */
  openRepository = (folder: string) => {
    const repoPath = withoutTrailingSlash(folder);
    return from(this.findMainWorktree(repoPath)).pipe(switchMap(main => {
      const id = main ?? repoPath;

      // Add repo if not already opened
      if (!this.gitRepositoryStore.repositories().some(r => r.id === id))
        this.gitRepositoryStore.addRepository(createRepository(id));

      // Select it — cwd is derived from selectedRepository, so this also updates cwd
      // Also closes the new tab if it was open (selectRepository calls deactivateNewTab)
      this.gitRepositoryStore.selectRepository(id);
      this.gitRepositoryStore.closeNewTab();

      // Works in the opened folder's worktree (back to the main worktree if that's the one opened), and refreshes git data
      return this.switchWorktree(repoPath);
    }));
  };

  closeRepository = (index: number) => {
    const wasSelected = index == this.gitRepositoryStore.selectedIndex();
    this.gitRepositoryStore.removeRepository(index);
    // The repository selected instead may not have its git data loaded yet
    if (wasSelected && this.gitRepositoryStore.hasRepositories()) this.gitRefresh.doRefreshAll();
  };

  reopenClosedRepository = () => {
    const reopened = this.gitRepositoryStore.reopenClosedRepository();
    if (!reopened) return;
    this.gitRepositoryStore.selectRepository(reopened);
    this.gitRefresh.doRefreshAll();
  };

  /** Ctrl+T: new tab, Ctrl+W: close the current tab, Ctrl+Shift+T: reopen the last closed one */
  handleTabShortcut = (event: KeyboardEvent) => {
    const {ctrlKey, shiftKey, altKey} = event;
    const key = event.key.toLowerCase(); // The typed letter, not the physical key (code): Ctrl+W is Ctrl+Z's key on AZERTY
    const store = this.gitRepositoryStore;
    if (!ctrlKey || altKey) return;

    if (key == 't' && shiftKey) {
      this.reopenClosedRepository();
    } else if (key == 't') {
      if (store.hasRepositories()) store.openNewTab(); // Without repositories, the welcome screen already is the new tab
    } else if (key == 'w' && !shiftKey) {
      if (store.newTabSelected()) store.closeNewTab();
      else if (store.selectedIndex() >= 0) this.closeRepository(store.selectedIndex());
    } else {
      return;
    }
    event.preventDefault();
  };

  initRepository = () => {
    from(window.tauri.dialog.showOpenDialog({properties: ['openDirectory']})).pipe(
      switchMap(picked => picked?.length ? this.initAndOpenRepository(picked[0]) : EMPTY),
    ).subscribe();
  };

  /**
   * Walks up from `gitDir` until a folder holding `.git` is found.
   * Resolves undefined when it isn't inside a git repository.
   */
  private findGitDir = async (gitDir: string): Promise<string | undefined> => {
    const files = await window.tauri.fs.readdir(gitDir);
    if (files.includes('.git'))
      return gitDir;

    const parentDir = window.tauri.path.dirname(gitDir);
    if (isRootDirectory(gitDir) || [gitDir, '.'].includes(parentDir))
      return undefined;
    return this.findGitDir(parentDir);
  };

}
