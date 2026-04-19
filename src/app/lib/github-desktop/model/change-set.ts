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

import {AppFileStatus, AppFileStatusKind, CommittedFileChange} from './status';

export interface ChangeSet {
  /** Files changed in the changeset. */
  readonly files: CommittedFileChange[];

  /** Origin of changeset */
  readonly kind: 'committed' | 'working-directory';

  /** Number of lines added in the changeset. */
  readonly linesAdded: number;

  /** Number of lines deleted in the changeset. */
  readonly linesDeleted: number;
}


/** encapsulate changes to a file associated with a commit */
export class FileChange {

  public readonly id: string;

  /**
   * @param path The relative path to the file in the repository.
   * @param status The status of the change to the file.
   */
  public constructor(
    public readonly path: string,
    public readonly status: AppFileStatus,
  ) {
    if (status.kind === AppFileStatusKind.Renamed || status.kind === AppFileStatusKind.Copied)
      this.id = `${status.kind}+${path}+${status.oldPath}`;
    else
      this.id = `${status.kind}+${path}`;
  }
}