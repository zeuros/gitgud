import {Injectable} from '@angular/core';
import {GitApiService} from "./git-api.service";
import {GitRepository} from "../models/git-repository";
import {Commit, parseRawUnfoldedTrailers} from "../models/commit";
import {LogParserService} from "./log-parser.service";
import {map, Observable} from "rxjs";
import {CommitIdentity} from "../models/commit-identity";

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private fields = {
    sha: '%H', // SHA
    shortSha: '%h', // short SHA
    summary: '%s', // summary
    body: '%b', // body
    branch: '%d',
    // author identity string, matching format of GIT_AUTHOR_IDENT.
    //   author name <author email> <author date>
    // author date format dependent on --date arg, should be raw
    author: '%an <%ae> %ad',
    committer: '%cn <%ce> %cd',
    parents: '%P', // parent SHAs,
    trailers: '%(trailers:unfold,only)',
    refs: '%D',
  };
  private logParse = this.logParserService.createLogParser(this.fields);

  constructor(
    private gitApiService: GitApiService,
    private logParserService: LogParserService,
  ) {
  }

  /**
   * Get the repository's commits using `revisionRange` and limited to `limit`
   */
  getCommitLog = (
    repositoryPath: string,
    revisionRange?: string,
    limit?: number,
    skip?: number,
    additionalArgs: ReadonlyArray<string> = []
  ): Observable<Commit[]> => {

    const args = ['log']

    if (revisionRange !== undefined) {
      args.push(revisionRange)
    }

    args.push('--date=raw')

    if (limit !== undefined) {
      args.push(`--max-count=${limit}`)
    }

    if (skip !== undefined) {
      args.push(`--skip=${skip}`)
    }


    args.push(
      ...this.formatArgs(),
      '--no-show-signature',
      '--no-color',
      ...additionalArgs,
      '--'
    )
    return this.gitApiService.git(args, repositoryPath)
      .pipe(map(log => this.logParse(log).map(commit => {
        // Ref is of the format: (HEAD -> master, tag: some-tag-name, tag: some-other-tag,with-a-comma, origin/master, origin/HEAD)
        // Refs are comma separated, but some like tags can also contain commas in the name, so we split on the pattern ", " and then
        // check each ref for the tag prefix. We used to use the regex /tag: ([^\s,]+)/g)`, but will clip a tag with a comma short.
        const tags = commit.refs
          .split(', ')
          .flatMap(ref => (ref.startsWith('tag: ') ? ref.substring(5) : []))

        return new Commit(
          commit.sha,
          commit.shortSha,
          commit.summary,
          commit.body,
          commit.branch,
          CommitIdentity.parseIdentity(commit.author),
          CommitIdentity.parseIdentity(commit.committer),
          commit.parents.length > 0 ? commit.parents.split(' ') : [],
          // We know for sure that the trailer separator will be ':' since we got
          // them from %(trailers:unfold) above, see `git help log`:
          //
          //   "key_value_separator=<SEP>: specify a separator inserted between
          //    trailer lines. When this option is not given each trailer key-value
          //    pair is separated by ": ". Otherwise it shares the same semantics as
          //    separator=<SEP> above."
          parseRawUnfoldedTrailers(commit.trailers, ':'),
          tags
        )
      })));
  }

  private formatArgs = () => {
    const format = Object.values(this.fields).join('%x00');
    return ['-z', `--format="${format}"`];
  }
}
