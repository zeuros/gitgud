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

import {CommitIdentity} from './commit-identity';
import {type Trailer} from '../../../models/interpret-trailers';
import {type LogObject} from '../../../models/log-object';
import {notUndefined} from '../../../utils/utils';

export const parseRawUnfoldedTrailers = (trailers: string, separators: string): Trailer[] =>
  trailers.split('\n').map(line => parseSingleUnfoldedTrailer(line, separators)).filter(notUndefined);

const parseSingleUnfoldedTrailer = (line: string, separators: string): Trailer | null => {
  for (const separator of separators) {
    const ix = line.indexOf(separator);
    if (ix > 0) {
      return {
        token: line.substring(0, ix).trim(),
        value: line.substring(ix + 1).trim(),
      };
    }
  }

  return null;
};

/**
 * @param sha
 * @param shortSha
 * @param summary The first line of the commit message.
 * @param body The commit message without the first line and CR.
 * @param branches Branches the commit is pointed by, separated by comma. e.g: origin/HEAD, origin/develop
 * @param ref Almost always present, tells which branch commit comes from.
 * @param refLogSubject TODO: remove ?
 * @param author Information about the author of this commit.
 *               Includes name, email and date.
 * @param committer Information about the committer of this commit.
 *                  Includes name, email and date.
 * @param parentSHAs The SHAs for the parents of the commit.
 * @param trailers Parsed, unfolded trailers from the commit message body,
 *                 if any, as interpreted by `git interpret-trailers`
 * @param tags Tags associated with this commit.
 */
export class Commit implements LogObject {

  /**
   * A value indicating whether the author and the committer
   * are the same person.
   */
  readonly authoredByCommitter: boolean;

  constructor(
    public readonly sha: string,
    public readonly shortSha: string,
    public readonly summary: string,
    public readonly body: string,
    public readonly branches: string, // Branches the commit is pointed by, separated by comma. e.g: origin/HEAD, origin/develop
    public readonly ref: string, //
    public readonly refLogSubject: string,
    public readonly author: CommitIdentity,
    public readonly committer: CommitIdentity,
    public readonly parentSHAs: string[],
    public readonly trailers: Trailer[],
    public readonly tags: string[],
  ) {
    this.authoredByCommitter =
      this.author.name === this.committer.name &&
      this.author.email === this.committer.email;
  }
}

/**
 * A minimal shape of data to represent a commit, for situations where the
 * application does not require the full commit metadata.
 *
 * Equivalent to the output where Git command support the
 * `--oneline --no-abbrev-commit` arguments to format a commit.
 */
export type CommitOneLine = {
  /** The full commit id associated with the commit */
  readonly sha: string
  /** The first line of the commit message */
  readonly summary: string
}