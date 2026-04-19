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
export class Branch {
  constructor(
    public readonly name: string,
    public readonly upstream: string | null,
    public readonly tip: IBranchTip,
    public readonly type: BranchType,
    public readonly ref: string,
    public readonly isHeadPointed = false,
  ) {
  }
}

/** The number of commits a revision range is ahead/behind. */
export interface IAheadBehind {
  readonly ahead: number
  readonly behind: number
}