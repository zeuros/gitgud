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
import {isRootDirectory, throwEx} from '../utils/utils';
import {createRepository} from '../utils/repository-utils';
import {FileWatcherService} from './file-watcher.service';
import {GitRepositoryStore} from '../stores/git-repos.store';
import {GitRefreshService} from './git-refresh.service';

@Injectable({
  providedIn: 'root',
})
export class GitRepositoryService {

  private fileWatcher = inject(FileWatcherService);
  private gitRepositoryStore = inject(GitRepositoryStore);
  private gitRefresh = inject(GitRefreshService);

  constructor() {
    effect(() => {
      const repo = this.gitRepositoryStore.selectedRepository();
      if (repo) this.fileWatcher.setWatcher(repo.id);
    });
  }

  pickFolderAndOpenRepository = () => {
    this.openRepository(this.pickGitFolder()).subscribe();
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
    this.gitRepositoryStore.selectRepository(repoPath);

    // Refresh git data
    return this.gitRefresh.refreshAll();
  };

  pickGitFolder = () => {

    const pickedGitFolder = (window.electron.dialog.showOpenDialogSync({properties: ['openDirectory']}) ?? throwEx('No folder picked'))[0];

    return this.findGitDir(pickedGitFolder);

  };

  /**
   * Walks up the picked directory tree until a `.git` folder is found.
   * Throws if no git repository exists.
   */
  findGitDir = (gitDir: string): string => {

    if (window.electron.fs.isFile(gitDir))
      return this.findGitDir(window.electron.path.dirname(gitDir));

    const files = window.electron.fs.readdirSync(gitDir);
    if (files.includes('.git'))
      return gitDir;
    else if (isRootDirectory(gitDir))
      return throwEx(`This folder is not a valid git repository`);
    else
      return this.findGitDir(window.electron.path.resolve(gitDir, '..'));
  };

}
