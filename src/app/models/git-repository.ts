import {Commit} from "../lib/github-desktop/model/commit";
import {Branch} from "../lib/github-desktop/model/branch";

export class GitRepository {
  constructor(
    public directory: string, // Identify the directory (like an id)
    public name: string,
    public sizes = [20, 50, 30], // panels sizes
    public selected = true, // This repository is selected
    public logs: ReadonlyArray<Commit> = [],
    public stashes: ReadonlyArray<Commit> = [],
    public branches: ReadonlyArray<Branch> = [],
    public selectedCommits?: string[],
    public highlightedCommitSha?: string,
    public checkedOutBranch?: Branch,
    public startCommit = 0,
    public remotes: { remote: string; url: string }[] = [],
  ) {
  }
}