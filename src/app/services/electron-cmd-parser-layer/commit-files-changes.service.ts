import {inject, Injectable} from '@angular/core';
import {GitApiService} from "./git-api.service";
import {ParserService} from "../parser.service";
import {map, Observable} from 'rxjs';
import {parseRawLogWithNumstat} from "../../lib/github-desktop/commit-files-changes";

@Injectable({
  providedIn: 'root'
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
  remoteHeadPointer?: string;

  private gitRepositoryService = inject(GitApiService);

  constructor(
    parserService: ParserService,
  ) {

    this.logParser = parserService.createForEachRefParser(this.fields);
  }

  // getChangedFilesForGivenCommit = (sha: string): Observable<ReadonlyArray<ChangeSet>> =>
  getChangedFilesForGivenCommit = (sha: string) =>
    this.gitRepositoryService.git(['log', sha, '-C', '-M', '-m', '-1', '--no-show-signature', '--first-parent', '--raw', '--format=format:', '--numstat', '-z', '--'])
      .pipe(map(rawFileChanges => parseRawLogWithNumstat(rawFileChanges, sha)));

}

