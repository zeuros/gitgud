import {DestroyRef, effect, inject, Injectable} from '@angular/core';
import {forkJoin, map, of, switchMap, tap} from 'rxjs';
import {GitRepository} from '../models/git-repository';
import {isRootDirectory, throwEx} from '../utils/utils';
import {createRepository, filterOutStashes} from '../utils/repository-utils';
import {LogReaderService} from './electron-cmd-parser-layer/log-reader.service';
import {StashReaderService} from './electron-cmd-parser-layer/stash-reader.service';
import {BranchReaderService} from './electron-cmd-parser-layer/branch-reader.service';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
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
  private readonly gitApi = inject(GitApiService);
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
      if (repo) this.onRepositorySelected(repo);
    });
  }

  private onRepositorySelected = ({id}: GitRepository) => {
    this.fileWatcher.setWatcher(id);
    this.gitApi.cwd.set(id);
  };

  /**
   * Opens or retrieve repository after user picks a repo folder
   * - Reuses an existing repo if already opened
   * - Marks it as selected
   * - Refreshes logs, branches, and stashes
   */
  openRepository = () => {
    const repoDirectory = this.pickGitFolder();

    const repos = this.gitRepositoryStore.repositories();

    let repo = repos.find(r => r.id === repoDirectory);

    // Add repo if not already opened
    if (!repo) {
      repo = createRepository(repoDirectory);
      this.gitRepositoryStore.addRepository(repo);
    }

    // Select it
    this.gitRepositoryStore.selectRepository(repoDirectory);

    // Refresh git data
    this.doUpdateLogsAndBranches();
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
          branches: this.branchReader.getBranches(), // Source will show which branch the  commit is in
          stashes: of(stashes), // Source will show which branch commit is in
        })),
        tap(r => this.gitRepositoryStore.updateSelectedRepository(r)),
      );


  doUpdateLogsAndBranches = () => this.updateLogsAndBranches().subscribe();

}
