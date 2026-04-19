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

/**
 * Base interface containing all the properties that progress events
 * need to support.
 */
interface IProgress {
  /**
   * The overall progress of the operation, represented as a fraction between
   * 0 and 1.
   */
  readonly value: number

  /**
   * An informative text for user consumption indicating the current operation
   * state. This will be high level such as 'Pushing origin' or
   * 'Fetching upstream' and will typically persist over a number of progress
   * events. For more detailed information about the progress see
   * the description field
   */
  readonly title?: string

  /**
   * An informative text for user consumption. In the case of git progress this
   * will usually be the last raw line of output from git.
   */
  readonly description?: string
}

/**
 * An object describing progression of an operation that can't be
 * directly mapped or attributed to either one of the more specific
 * progress events (Fetch, Checkout etc). An example of this would be
 * our own refreshing of internal repository state that takes part
 * after fetch, push and pull.
 */
export interface IGenericProgress extends IProgress {
  kind: 'generic'
}

/**
 * An object describing the progression of a fetch operation
 */
export interface IFetchProgress extends IProgress {
  kind: 'fetch'

  /**
   * The remote that's being fetched
   */
  readonly remote: string
}

/**
 * An object describing the progression of a pull operation
 */
export interface IPullProgress extends IProgress {
  kind: 'pull'

  /**
   * The remote that's being pulled from
   */
  readonly remote: string
}

/**
 * An object describing the progression of a pull operation
 */
export interface IPushProgress extends IProgress {
  kind: 'push'

  /**
   * The remote that's being pushed to
   */
  readonly remote: string

  /**
   * The branch that's being pushed
   */
  readonly branch: string
}

/**
 * An object describing the progression of a fetch operation
 */
export interface ICloneProgress extends IProgress {
  kind: 'clone'
}

/** An object describing the progression of a revert operation. */
export interface IRevertProgress extends IProgress {
  kind: 'revert'
}

export interface IMultiCommitOperationProgress extends IProgress {
  readonly kind: 'multiCommitOperation'
  /** The summary of the commit applied */
  readonly currentCommitSummary: string
  /** The number to signify which commit in a selection is being applied */
  readonly position: number
  /** The total number of commits in the operation */
  readonly totalCommitCount: number
}

export type Progress =
  | IGenericProgress
  | IFetchProgress
  | IPullProgress
  | IPushProgress
  | IRevertProgress
  | IMultiCommitOperationProgress
