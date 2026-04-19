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
import {Commit, parseRawUnfoldedTrailers} from '../../lib/github-desktop/model/commit';
import {createLogParser} from '../parser.service';
import {map, Observable} from 'rxjs';
import {CommitIdentity} from '../../lib/github-desktop/model/commit-identity';
import {GitApiService} from './git-api.service';
import {short} from '../../utils/commit-utils';

@Injectable({
  providedIn: 'root',
})
export class LogReaderService {
  private fields = {
    sha: '%H', // SHA
    shortSha: '%h', // short SHA
    summary: '%s', // summary
    body: '%b', // body
    branch: '%D', // same as branch, without '(%x,%y)' wrapping
    ref: '%S', // Associated reference, for EACH commit (%d show branch but only for last commit of the branch)
    refLogSubject: '%gs',
    // author identity string, matching format of GIT_AUTHOR_IDENT.
    //   author name <author email> <author date>
    // author date format dependent on --date arg, should be raw
    author: '%an <%ae> %ad',
    committer: '%cn <%ce> %cd',
    parents: '%P', // parent SHAs,
    trailers: '%(trailers:unfold,only)',
    refs: '%D',
  };
  private gitApi = inject(GitApiService);
  private readonly parser = createLogParser(this.fields);


  /**
   * Get the repository's commits using `revisionRange` and limited to `limit`
   */
  getCommitLog = (
    revisionRange?: string,
    limit?: number,
    skip?: number,
    additionalArgs: string[] = [],
  ): Observable<Commit[]> => {

    const args = ['log'];

    if (revisionRange !== undefined) {
      args.push(revisionRange);
    }

    if (limit !== undefined) {
      args.push(`--max-count=${limit}`);
    }

    if (skip !== undefined) {
      args.push(`--skip=${skip}`);
    }


    args.push(
      '--date=raw',
      '--all',
      '-z', // Separate lines with NUL character
      this.parser.formatArg,
      '--no-show-signature',
      '--no-color',
      ...additionalArgs,
      '--',
    );
    return this.gitApi.git(args)
      .pipe(map(log => this.parser.parse(log).map(commit => {
        // Ref is of the format: (HEAD -> master, tag: some-tag-name, tag: some-other-tag,with-a-comma, origin/master, origin/HEAD)
        // Refs are comma separated, but some like tags can also contain commas in the name, so we split on the pattern ", " and then
        // check each ref for the tag prefix. We used to use the regex /tag: ([^\s,]+)/g)`, but will clip a tag with a comma short.
        const tags = commit.refs
          .split(', ')
          .flatMap(ref => (ref.startsWith('tag: ') ? ref.substring(5) : []));

        return new Commit(
          commit.sha,
          short(commit.shortSha),
          commit.summary,
          commit.body,
          commit.branch,
          commit.ref,
          commit.refLogSubject,
          CommitIdentity.parseIdentity(commit.author),
          CommitIdentity.parseIdentity(commit.committer),
          commit.parents.length > 0 ? commit.parents.split(' ') : [],
          // We know for sure that the trailer separator will be ':' since we got
          // them from %(trailers:unfold) above, see `git help log`:
          //
          //   key_value_separator=<SEP>: specify a separator inserted between
          //    trailer lines. When this option is not given each trailer key-value
          //    pair is separated by ": ". Otherwise, it shares the same semantics as
          //    separator=<SEP> above."
          parseRawUnfoldedTrailers(commit.trailers, ':'),
          tags,
        );
      })));
  };
}
