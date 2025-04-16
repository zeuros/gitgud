import {CommitIdentity} from "../lib/github-desktop/model/commit-identity";
import {Trailer} from "./interpret-trailers";

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
  trailers: ReadonlyArray<Trailer>
  tags: ReadonlyArray<string>
}