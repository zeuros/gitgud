import {CommitIdentity} from "../lib/github-desktop/model/commit-identity";
import {ITrailer} from "./interpret-trailers";
import {LogObject} from "./log-object";


export class Stash implements LogObject {

  public constructor(
    public readonly sha: string,
    public readonly shortSha: string,
    public readonly summary: string,
    public readonly body: string,
    public readonly branches: string,
    public readonly ref: string,
    public readonly refLogSubject: string,
    public readonly author: CommitIdentity,
    public readonly committer: CommitIdentity,
    public readonly parentSHAs: ReadonlyArray<string>,
    public readonly trailers: ReadonlyArray<ITrailer>,
    public readonly tags: ReadonlyArray<string>,
  ) {
  }
}