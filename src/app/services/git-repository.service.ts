import {DestroyRef, effect, inject, Injectable} from '@angular/core';
import {forkJoin, map, of, switchMap} from 'rxjs';
import {GitRepository} from '../models/git-repository';
import {isRootDirectory, throwEx} from '../utils/utils';
import {createRepository, filterOutStashes} from '../utils/repository-utils';
import {LogService} from './electron-cmd-parser-layer/log.service';
import {StashService} from './electron-cmd-parser-layer/stash.service';
import {BranchService} from './electron-cmd-parser-layer/branch.service';
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
  private readonly logService = inject(LogService);
  private readonly branchService = inject(BranchService);
  private readonly stashService = inject(StashService);
  private readonly gitApiService = inject(GitApiService);
  private readonly fileWatcher = inject(FileWatcherService);
  private readonly gitRepositoryStore = inject(GitRepositoryStore);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {

    // Refresh data when window regains focus
    window.electron.onWindowFocus(this.updateLogsAndBranches);
    this.destroyRef.onDestroy(() => window.electron.offWindowFocus(this.updateLogsAndBranches));

    // React to repository selection changes
    effect(() => {
      const repo = this.gitRepositoryStore.selectedRepository();
      if (repo) this.onRepositorySelected(repo);
    });
  }

  private onRepositorySelected = ({id}: GitRepository) => {
    this.fileWatcher.setWatcher(id);
    this.gitApiService.cwd.set(id);
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
    this.updateLogsAndBranches();
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
  updateLogsAndBranches = () => {
    this.stashService.getStashes()
      .pipe(
        switchMap(stashes => forkJoin({
          logs: this.logService.getCommitLog('--branches', DEFAULT_NUMBER_OR_COMMITS_TO_SHOW, 0, ['--remotes', '--tags', '--source', '--date-order', ...stashes.map(s => s.sha)])
            .pipe(map(logs => logs.filter(filterOutStashes(stashes)))),
          branches: this.branchService.getBranches(), // Source will show which branch the  commit is in
          stashes: of(stashes), // Source will show which branch commit is in
        })),
      )
      .subscribe(r => this.gitRepositoryStore.updateSelectedRepository(r));
  };

}
