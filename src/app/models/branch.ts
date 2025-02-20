import {CommitIdentity} from './commit-identity'

// NOTE: The values here matter as they are used to sort
// local and remote branches, Local should come before Remote
export enum BranchType {
  Local = 0,
  Remote = 1,
}


/** Basic data about the latest commit on the branch. */
export interface IBranchTip {
  readonly sha: string
  readonly author: CommitIdentity
}

/** A branch as loaded from Git. */
export class Branch {
  /**
   * A branch as loaded from Git.
   *
   * @param name The short name of the branch. E.g., `main`.
   * @param upstream The remote-prefixed upstream name. E.g., `origin/main`.
   * @param tip Basic information (sha and author) of the latest commit on the branch.
   * @param type The type of branch, e.g., local or remote.
   * @param ref The canonical ref of the branch
   * @param isHeadPointed If the branch is pointed by HEAD
   */
  public constructor(
    public readonly name: string,
    public readonly upstream: string | null,
    public readonly tip: IBranchTip,
    public readonly type: BranchType,
    public readonly ref: string,
    public readonly isHeadPointed = false,
  ) {
  }
}
