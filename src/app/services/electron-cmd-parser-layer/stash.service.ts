import {inject, Injectable} from '@angular/core';
import {Commit, parseRawUnfoldedTrailers} from "../../models/commit";
import {ParserService} from "../parser.service";
import {map, Observable} from "rxjs";
import {CommitIdentity} from "../../models/commit-identity";
import {formatArg} from "../../utils/log-utils";

@Injectable({
  providedIn: 'root'
})
export class StashService {
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
  private logParserService = inject(ParserService);
  private stashParse = this.logParserService.createParser(this.fields);

  /**
   * Get the repository's commits using `revisionRange` and limited to `limit`
   */
  getStashes = (git: (args?: string[]) => Observable<any>, additionalArgs: ReadonlyArray<string> = []) => {

    // TODO: refactor with LogService
    const args = [
      'stash',
      'list',
      '--date=raw',
      '-z', // Separate lines with NUL character
      formatArg(this.fields),
      '--no-show-signature',
      '--no-color',
      ...additionalArgs,
      '--'
    ]

    return git(args)
      .pipe(map(log => this.stashParse(log).map(stash => {
        // Ref is of the format: (HEAD -> master, tag: some-tag-name, tag: some-other-tag,with-a-comma, origin/master, origin/HEAD)
        // Refs are comma separated, but some like tags can also contain commas in the name, so we split on the pattern ", " and then
        // check each ref for the tag prefix. We used to use the regex /tag: ([^\s,]+)/g)`, but will clip a tag with a comma short.

        const tags = stash.refs
          .split(', ')
          .flatMap(ref => (ref.startsWith('tag: ') ? ref.substring(5) : []))


        return new Commit(
          stash.sha,
          stash.shortSha,
          stash.summary,
          stash.body,
          stash.branch ?? '',
          stash.ref,
          stash.refLogSubject,
          CommitIdentity.parseIdentity(stash.author),
          CommitIdentity.parseIdentity(stash.committer),
          stash.parents.length > 0 ? stash.parents.split(' ') : [],
          // We know for sure that the trailer separator will be ':' since we got
          // them from %(trailers:unfold) above, see `git help log`:
          //
          //   "key_value_separator=<SEP>: specify a separator inserted between
          //    trailer lines. When this option is not given each trailer key-value
          //    pair is separated by ": ". Otherwise, it shares the same semantics as
          //    separator=<SEP> above."
          parseRawUnfoldedTrailers(stash.trailers, ':'),
          tags
        )
      })));
  }

}
