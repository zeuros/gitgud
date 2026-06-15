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

import {computed, effect, inject, Injectable} from '@angular/core';
import {EMPTY, from, switchMap} from 'rxjs';
import {isRootDirectory, throwEx} from '../utils/utils';
import {createRepository} from '../utils/repository-utils';
import {FileWatcherService} from './file-watcher.service';
import {GitRepositoryStore} from '../stores/git-repos.store';
import {GitRefreshService} from './git-refresh.service';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';

@Injectable({
  providedIn: 'root',
})
export class GitRepositoryService {

  private fileWatcher = inject(FileWatcherService);
  private gitRepositoryStore = inject(GitRepositoryStore);
  private gitRefresh = inject(GitRefreshService);
  private gitApi = inject(GitApiService);

  // Memoized on string equality — only changes when the actual repo path switches,
  // not on every workDirStatus / selectedCommitsShas update.
  private selectedRepoId = computed(() => this.gitRepositoryStore.selectedRepository()?.id);

  constructor() {
    effect(() => {
      const id = this.selectedRepoId();
      if (id) this.fileWatcher.setWatcher(id);
    });
  }

  pickFolderAndOpenRepository = () => {
    from(this.pickGitFolder()).pipe(
      switchMap(path => this.openRepository(path)),
    ).subscribe();
  };

  /**
   * Opens or retrieve repository after user picks a repo folder
   * - Reuses an existing repo if already opened
   * - Marks it as selected
   * - Refreshes logs, branches, and stashes
   */
  openRepository = (repoPath: string) => {

    const repos = this.gitRepositoryStore.repositories();

    let repo = repos.find(r => r.id === repoPath);

    // Add repo if not already opened
    if (!repo) {
      repo = createRepository(repoPath);
      this.gitRepositoryStore.addRepository(repo);
    }

    // Select it — cwd is derived from selectedRepository, so this also updates cwd
    // Also closes the new tab if it was open (selectRepository calls deactivateNewTab)
    this.gitRepositoryStore.selectRepository(repoPath);
    this.gitRepositoryStore.closeNewTab();

    // Refresh git data
    return this.gitRefresh.refreshAll();
  };

  initRepository = () => {
    from(window.tauri.dialog.showOpenDialog({properties: ['openDirectory']})).pipe(
      switchMap(picked => {
        if (!picked?.length) return EMPTY;
        const dir = picked[0];
        return this.gitApi.init(dir).pipe(switchMap(() => this.openRepository(dir)));
      }),
    ).subscribe();
  };

  pickGitFolder = async (): Promise<string> => {
    const picked = await window.tauri.dialog.showOpenDialog({properties: ['openDirectory']});
    if (!picked?.length) throwEx('No folder picked');
    return this.findGitDir(picked![0]);
  };

  /**
   * Walks up the picked directory tree until a `.git` folder is found.
   * Throws if no git repository exists.
   */
  findGitDir = async (gitDir: string): Promise<string> => {
    const isFile = await window.tauri.fs.isFile(gitDir).catch(() => false);
    if (isFile)
      return this.findGitDir(window.tauri.path.dirname(gitDir));

    const files = await window.tauri.fs.readdir(gitDir);
    if (files.includes('.git'))
      return gitDir;
    else if (isRootDirectory(gitDir))
      throwEx(`This folder is not a valid git repository`);
    else
      return this.findGitDir(window.tauri.path.resolve(gitDir, '..'));

    return gitDir;
  };

}
