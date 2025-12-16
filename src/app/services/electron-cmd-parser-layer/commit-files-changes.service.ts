import {inject, Injectable} from '@angular/core';
import {ParserService} from '../parser.service';
import {map} from 'rxjs';
import {parseIndexChanges, parseRawLogWithNumstat} from '../../lib/github-desktop/commit-files-changes';
import {GitRepositoryService} from '../git-repository.service';

@Injectable({
  providedIn: 'root',
})
export class CommitFilesChangesService {

  readonly fields = {
    fullName: '%(refname)',
    shortName: '%(refname:short)',
    upstreamShortName: '%(upstream:short)',
    sha: '%(objectname)',
    author: '%(author)',
    symRef: '%(symref)',
    head: '%(HEAD)',
  };

  logParser;

  private gitRepositoryService = inject(GitRepositoryService);

  constructor(
    parserService: ParserService,
  ) {

    this.logParser = parserService.createForEachRefParser(this.fields);
  }

  // getChangedFilesForGivenCommit = (sha: string): Observable<ReadonlyArray<ChangeSet>> =>
  getChangedFilesForGivenCommit = (sha: string) =>
    this.gitRepositoryService.git(['log', sha, '-C', '-M', '-m', '-1', '--no-show-signature', '--first-parent', '--raw', '--format=format:', '--numstat', '-z', '--'])
      .pipe(map(rawFileChanges => parseRawLogWithNumstat(rawFileChanges, sha)));


  // FIXME: browken
  // getCommitDiff = getCommitDiff(this.gitRepositoryService);

  /**
   * Get a list of files which have recorded changes in the index as compared to
   * HEAD along with the type of change.
   */
  indexChanges = (stagedFiles = false) =>
    this.gitRepositoryService.git(['diff-index', '--name-status', stagedFiles ? '--cached' : '', '-z', 'HEAD', '--'])
      .pipe(map(parseIndexChanges));

}

