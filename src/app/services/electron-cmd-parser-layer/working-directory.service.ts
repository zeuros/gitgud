import {DestroyRef, inject, Injectable} from '@angular/core';
import {map} from 'rxjs';
import {parseRawLogWithNumstat, parseWorkingDirChanges} from '../../lib/github-desktop/commit-files-changes';
import {FileWatcherService} from '../file-watcher.service';
import {GitApiService} from './git-api.service';
import {WorkingDirectoryFileChange} from '../../lib/github-desktop/model/status';
import {GitRepositoryStore} from '../../stores/git-repos.store';

@Injectable({
  providedIn: 'root',
})
export class WorkingDirectoryService {


  private readonly gitRepositoryStore = inject(GitRepositoryStore);
  private readonly gitApiService = inject(GitApiService);
  private readonly fileWatcherService = inject(FileWatcherService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Refresh working directory changes on app startup, window focus, or file system changes
    this.fetchWorkingDirChanges();

    window.electron.onWindowFocus(this.fetchWorkingDirChanges);
    this.destroyRef.onDestroy(() => window.electron.offWindowFocus(this.fetchWorkingDirChanges));

    this.fileWatcherService.onWorkingDirFileChange$.subscribe(this.fetchWorkingDirChanges);
  }

  /**
   * Retrieves the list of changed files for a specific commit.
   *
   * @param sha commit hash
   * @returns An Observable emitting an array of file changes: added, modified, and deleted files,
   *          along with their statistics (e.g., lines added/removed).
   */
  getChangedFilesForGivenCommit = (sha: string) =>
    this.gitApiService.git(['log', sha, '-C', '-M', '-m', '-1', '--no-show-signature', '--first-parent', '--raw', '--format=format:', '--numstat', '-z', '--'])
      .pipe(map(rawFileChanges => parseRawLogWithNumstat(rawFileChanges, sha)));


  readonly stageFile = ({path}: WorkingDirectoryFileChange) => this.gitApiService.git(['add', '--', path]).subscribe(this.fetchWorkingDirChanges);
  readonly unstageFile = ({path}: WorkingDirectoryFileChange) => this.gitApiService.git(['reset', '--', path]).subscribe(this.fetchWorkingDirChanges);

  readonly stageAll = () => this.gitApiService.git(['add', '--all']).subscribe(this.fetchWorkingDirChanges);
  readonly unstageAll = () => this.gitApiService.git(['reset', 'HEAD', '--', '.']).subscribe(this.fetchWorkingDirChanges);

  /**
   * Get a list of files which have recorded changes in the index as compared to
   * HEAD along with the type of change.
   */
  readonly fetchWorkingDirChanges = () =>
    this.gitApiService.git([
      'status',
      '--porcelain',
      '-z',
      '--',
    ])
      .pipe(map(parseWorkingDirChanges))
      .subscribe(workDirStatus => this.gitRepositoryStore.updateSelectedRepository({workDirStatus}));

}

