import {inject, Injectable} from '@angular/core';
import {map} from 'rxjs';
import {parseRawLogWithNumstat, parseWorkingDirChanges} from '../../lib/github-desktop/commit-files-changes';
import {GitRepositoryService} from '../git-repository.service';

@Injectable({
  providedIn: 'root',
})
export class CommitFilesChangesService {

  private gitRepositoryService = inject(GitRepositoryService);

  // getChangedFilesForGivenCommit = (sha: string): Observable<ReadonlyArray<ChangeSet>> =>
  /**
   * Retrieves the list of changed files for a specific commit.
   *
   * @param sha commit hash
   * @returns An Observable emitting an array of file changes: added, modified, and deleted files,
   *          along with their statistics (e.g., lines added/removed).
   */
  getChangedFilesForGivenCommit = (sha: string) =>
    this.gitRepositoryService.git(['log', sha, '-C', '-M', '-m', '-1', '--no-show-signature', '--first-parent', '--raw', '--format=format:', '--numstat', '-z', '--'])
      .pipe(map(rawFileChanges => parseRawLogWithNumstat(rawFileChanges, sha)));


  /**
   * Get a list of files which have recorded changes in the index as compared to
   * HEAD along with the type of change.
   */
  workingDirChanges = (stagedFiles = false) =>
    this.gitRepositoryService.git([
      'status',
      '--porcelain',
      '-z',
      '--',
    ])
      .pipe(map(parseWorkingDirChanges));

}

