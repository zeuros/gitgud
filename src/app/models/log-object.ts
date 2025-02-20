import {CommitIdentity} from "./commit-identity";
import {ITrailer} from "./interpret-trailers";

export interface LogObject {
  sha: string
  shortSha: string
  summary: string
  body: string
  branches: string
  ref: string
  refLogSubject: string
  author: CommitIdentity
  committer: CommitIdentity
  parentSHAs: ReadonlyArray<string>
  trailers: ReadonlyArray<ITrailer>
  tags: ReadonlyArray<string>
}