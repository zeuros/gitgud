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

import {CommitOneLine} from "./commit"
import {IMultiCommitOperationProgress} from "./progress"
import {ComputedAction} from "./computed-action";


/**
 * Rebase internal state used to track how and where the rebase is applied to
 * the repository.
 */
export type RebaseInternalState = {
  /** The branch containing commits that should be rebased */
  readonly targetBranch: string
  /**
   * The commit ID of the base branch, to be used as a starting point for
   * the rebase.
   */
  readonly baseBranchTip: string
  /**
   * The commit ID of the target branch at the start of the rebase, which points
   * to the original commit history.
   */
  readonly originalBranchTip: string
}

/**
 * Options to pass in to rebase progress reporting
 */
export type RebaseProgressOptions = {
  commits: CommitOneLine[]
  /** The callback to fire when rebase progress is reported */
  progressCallback: (progress: IMultiCommitOperationProgress) => void
}

export type CleanRebase = {
  readonly kind: ComputedAction.Clean
  readonly commits: CommitOneLine[]
}

export type RebaseWithConflicts = {
  readonly kind: ComputedAction.Conflicts
}

export type RebaseNotSupported = {
  readonly kind: ComputedAction.Invalid
}

export type RebaseLoading = {
  readonly kind: ComputedAction.Loading
}

export type RebasePreview =
  | CleanRebase
  | RebaseWithConflicts
  | RebaseNotSupported
  | RebaseLoading

/** Represents a snapshot of the rebase state from the Git repository  */
export type GitRebaseSnapshot = {
  /** The sequence of commits that are used in the rebase */
  readonly commits: CommitOneLine[]
  /** The progress of the operation */
  readonly progress: IMultiCommitOperationProgress
}
