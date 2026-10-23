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

import {inject, Injectable} from '@angular/core';
import {type FileChange, isCommittedFileChange} from '../lib/github-desktop/model/status';
import type {WorkingDirectoryFileChange} from '../lib/github-desktop/model/workdir';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import type {ChangeSet} from '../lib/github-desktop/model/change-set';
import {catchError, combineLatest, forkJoin, from, map, type Observable, of} from 'rxjs';
import {parseRawLogWithNumstat} from '../lib/github-desktop/commit-files-changes';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {mergeChangeSets} from '../lib/github-desktop/diff/diff-utils';

/** One side of a diff: a git revision ('' = index), or the working directory */
export const WORKDIR = Symbol('workdir');
export type DiffSide = string | typeof WORKDIR;

/** Which versions of the file a diff compares */
export const diffSides = (file: FileChange): {before: DiffSide, after: DiffSide} => {
  if (isCommittedFileChange(file)) return {before: file.baseCommitish ?? `${file.commitish}^`, after: file.commitish};
  return (file as WorkingDirectoryFileChange).staged
    ? {before: 'HEAD', after: ''}   // staged: HEAD vs index
    : {before: '', after: WORKDIR}; // unstaged: index vs workdir
};

// ignoreBOM keeps the BOM like `git show` does, otherwise it would show up as a diff
const utf8Decoder = new TextDecoder('utf-8', {ignoreBOM: true});

@Injectable({
  providedIn: 'root',
})
export class FileDiffService {

  private gitApi = inject(GitApiService);
  private currentRepo = inject(CurrentRepoStore);

  /**
   * Retrieves the list of changed files for multiple commits.
   *
   * - 1 commit: Show files changed in that commit
   * - 2 commits: Show cumulative diff between the two (range)
   * - 3+ commits: Merge all individual commit diffs together
   */
  getChangedFilesForGivenCommits = (shas: string[]): Observable<ChangeSet | undefined> => {
    if (shas.length === 0) {
      return of(undefined);
    }

    // Single commit: show changes in that commit
    if (shas.length === 1) {
      return this.getChangedFilesForGivenCommit(shas[0]);
    }

    // Sort commits oldest to newest
    const logs = this.currentRepo.logs();
    const sortedShas = [...shas].sort((a, b) =>
      logs.findIndex(l => l.sha === b) - logs.findIndex(l => l.sha === a),
    );

    // Two commits: show range diff
    if (sortedShas.length === 2) {
      const [older, newer] = sortedShas;

      return this.gitApi.git([
        'diff',
        older,
        newer,
        '-C',              // Detect copies
        '-M',              // Detect renames
        '--raw',           // Raw format
        '--numstat',       // Numeric stats
        '-z',              // NUL separator
        '--no-color',      // No color codes
        '--',
      ]).pipe(
        map(output => parseRawLogWithNumstat(output, sortedShas)),
      );
    }

    // Three or more commits: merge individual diffs
    return forkJoin(
      sortedShas.map(sha => this.getChangedFilesForGivenCommit(sha)),
    ).pipe(
      map(mergeChangeSets),
    );
  };

  /**
   * Retrieves the list of changed files for a specific commit.
   *
   * @param sha commit hash
   * @returns An Observable emitting an array of file changes: added, modified, and deleted files,
   *          along with their statistics (e.g., lines added/removed).
   */
  /** Full content of a file at a given git revision. Returns empty string if the file didn't exist. */
  getFileAtRevision = (path: string, revision = 'HEAD') =>
    this.gitApi.git(['show', `${revision}:${path}`]).pipe(catchError(() => of('')));

  /** Raw bytes of a file at a given git revision ('' = index). Empty buffer if the file didn't exist. */
  getFileBytesAtRevision = (path: string, revision = 'HEAD') =>
    this.gitApi.gitBytes(['show', `${revision}:${path}`]).pipe(catchError(() => of(new ArrayBuffer(0))));

  /** Size in bytes of a file at a given git revision ('' = index), without reading it. 0 if the file didn't exist. */
  getFileSizeAtRevision = (path: string, revision = 'HEAD') =>
    this.gitApi.git(['cat-file', '-s', `${revision}:${path}`]).pipe(map(Number), catchError(() => of(0)));

  // A missing file (added / deleted side) reads as empty
  getFileSize = (path: string, side: DiffSide) =>
    side === WORKDIR
      ? from(window.tauri.fs.size(this.workDirPath(path))).pipe(catchError(() => of(0)))
      : this.getFileSizeAtRevision(path, side);

  /** Largest size of the two diffed versions of a file, read without loading them */
  getDiffSize = (file: FileChange) => {
    const {before, after} = diffSides(file);
    return combineLatest([this.getFileSize(file.path, before), this.getFileSize(file.path, after)])
      .pipe(map(sizes => Math.max(...sizes)));
  };

  getFileBytes = (path: string, side: DiffSide) =>
    side === WORKDIR
      ? from(window.tauri.fs.readFileBytes(this.workDirPath(path))).pipe(catchError(() => of(new ArrayBuffer(0))))
      : this.getFileBytesAtRevision(path, side);

  getFileText = (path: string, side: DiffSide) =>
    side === WORKDIR
      ? this.getFileBytes(path, side).pipe(map(bytes => utf8Decoder.decode(bytes)))
      : this.getFileAtRevision(path, side);

  private workDirPath = (path: string) => window.tauri.path.resolve(this.currentRepo.cwd()!, path);

  getChangedFilesForGivenCommit = (sha: string) =>
    this.gitApi.git(['log', sha, '-C', '-M', '-m', '-1', '--no-show-signature', '--first-parent', '--raw', '--format=format:', '--numstat', '-z', '--'])
      .pipe(map(rawFileChanges => parseRawLogWithNumstat(rawFileChanges, [sha])));

  // Stashes are merge commits — git log --first-parent -m produces no numstat for them.
  // git diff sha^1 sha directly compares the stash against HEAD-at-stash-time.
  getChangedFilesForStash = (sha: string) =>
    this.gitApi.git(['diff', `${sha}^1`, sha, '-C', '-M', '--raw', '--numstat', '-z', '--'])
      .pipe(map(rawFileChanges => parseRawLogWithNumstat(rawFileChanges, [sha])));

}
