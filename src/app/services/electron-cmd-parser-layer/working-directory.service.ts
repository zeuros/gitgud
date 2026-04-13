import {DestroyRef, inject, Injectable} from '@angular/core';
import {map, tap} from 'rxjs';
import {parseWorkingDirChanges} from '../../lib/github-desktop/commit-files-changes';
import {FileWatcherService} from '../file-watcher.service';
import {GitApiService} from './git-api.service';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {WorkingDirectoryFileChange} from '../../lib/github-desktop/model/workdir';

@Injectable({
  providedIn: 'root',
})
export class WorkingDirectoryService {


  private readonly currentRepo = inject(CurrentRepoStore);
  private readonly gitApi = inject(GitApiService);
  private readonly fileWatcher = inject(FileWatcherService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Refresh working directory changes on app startup, window focus, or file system changes
    this.doFetchWorkingDirChanges();

    window.electron.onWindowFocus(this.doFetchWorkingDirChanges);
    this.destroyRef.onDestroy(() => window.electron.offWindowFocus(this.doFetchWorkingDirChanges));

    this.fileWatcher.onWorkingDirFileChange$.subscribe(this.doFetchWorkingDirChanges);
  }

  readonly stageFile = ({path}: WorkingDirectoryFileChange) => this.gitApi.git(['add', '--', path]).subscribe(this.doFetchWorkingDirChanges);

  /** Stage (or unstage) a patch via stdin, then refresh */
  readonly stageChangesWithPatch = (patch: string, stage: boolean) =>
    this.gitApi.gitWithInput(['apply', ...(stage ? [] : ['-R']), '--cached', '--unidiff-zero', '--allow-overlap', '-'], patch).subscribe(this.doFetchWorkingDirChanges);

  readonly unstageFile = ({path}: WorkingDirectoryFileChange) => this.gitApi.git(['reset', '--', path]).subscribe(this.doFetchWorkingDirChanges);

  readonly stageAll = () => this.gitApi.git(['add', '--all']).subscribe(this.doFetchWorkingDirChanges);
  readonly unstageAll = () => this.gitApi.git(['reset', 'HEAD', '--', '.']).subscribe(this.doFetchWorkingDirChanges);

  /**
   * Get a list of files which have recorded changes in the index as compared to
   * HEAD along with the type of change.
   */
  readonly fetchWorkingDirChanges = () =>
    this.gitApi.git([
      'status',
      '--porcelain',
      '-z',
      '--',
    ])
      .pipe(
        map(parseWorkingDirChanges),
        tap(workDirStatus => this.currentRepo.update({workDirStatus})),
      );

  /**
   * Get a list of files which have recorded changes in the index as compared to
   * HEAD along with the type of change.
   */
  readonly doFetchWorkingDirChanges = () => this.fetchWorkingDirChanges().subscribe();

}

