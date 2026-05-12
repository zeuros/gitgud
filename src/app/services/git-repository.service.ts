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

import {DestroyRef, effect, inject, Injectable} from '@angular/core';
import {forkJoin, map, of, switchMap, tap} from 'rxjs';
import {GitRepository} from '../models/git-repository';
import {isRootDirectory, throwEx} from '../utils/utils';
import {createRepository, filterOutStashes} from '../utils/repository-utils';
import {LogReaderService} from './electron-cmd-parser-layer/log-reader.service';
import {StashReaderService} from './electron-cmd-parser-layer/stash-reader.service';
import {TagReaderService} from './electron-cmd-parser-layer/tag-reader.service';
import {BranchReaderService} from './electron-cmd-parser-layer/branch-reader.service';
import {FileWatcherService} from './file-watcher.service';
import {GitRepositoryStore} from '../stores/git-repos.store';

const DEFAULT_NUMBER_OR_COMMITS_TO_SHOW = 1200;

/**
 * State manager for Git repositories.
 *
 * - Tracks opened repositories and current selection
 * - Persist repository state to local storage
 * - Coordinate git/log/branch/stash services
 * - React to window focus and filesystem changes
 *
 * FIXME: Too complicated + rename to ElectronGit ?
 */
@Injectable({
  providedIn: 'root',
})
export class GitRepositoryService {

  // Services
  private readonly logReader = inject(LogReaderService);
  private readonly branchReader = inject(BranchReaderService);
  private readonly stashReader = inject(StashReaderService);
  private readonly tagReader = inject(TagReaderService);
  private readonly fileWatcher = inject(FileWatcherService);
  private readonly gitRepositoryStore = inject(GitRepositoryStore);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {

    // Refresh data when window regains focus
    window.electron.onWindowFocus(this.doUpdateLogsAndBranches);
    this.destroyRef.onDestroy(() => window.electron.offWindowFocus(this.doUpdateLogsAndBranches));

    // React to repository selection changes
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

    // Select it
    this.gitRepositoryStore.selectRepository(repoPath);

    // Refresh git data
    return this.updateLogsAndBranches();
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


  /**
   * Fetches logs, branches, and stashes for the current repository
   * and returns a partial repository update.
   */
  updateLogsAndBranches = () =>
    this.stashReader.getStashes()
      .pipe(
        switchMap(stashes => forkJoin({
          logs: this.logReader.getCommitLog('--branches', DEFAULT_NUMBER_OR_COMMITS_TO_SHOW, 0, ['--remotes', '--tags', '--source', '--date-order', ...stashes.map(s => s.sha)])
            .pipe(map(logs => logs.filter(filterOutStashes(stashes)))),
          branches: this.branchReader.getBranches(),
          detachedHeadSha: this.branchReader.detachedHeadSha(),
          stashes: of(stashes),
          tags: this.tagReader.getTags(),
        })),
        tap((r: Partial<GitRepository>) => this.gitRepositoryStore.updateSelectedRepository(r)),
      );


  doUpdateLogsAndBranches = () => this.updateLogsAndBranches().subscribe();

}
