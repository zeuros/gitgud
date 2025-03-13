import {Commit} from "./commit";
import {Branch} from "./branch";

export class GitRepository {
  constructor(
    public directory: string, // Identify the directory (like an id)
    public name: string,
    public sizes = [20, 50, 30], // panels sizes
    public selected = true, // currently selected
    public logs: ReadonlyArray<Commit> = [],
    public stashes: ReadonlyArray<Commit> = [],
    public branches: ReadonlyArray<Branch> = [],
    public startCommit = 0,
    public currentBranch?: string,
    public remoteBranches: string[] = [],
    public remotes: { remote: string; url: string }[] = [],
  ) {
  }
}