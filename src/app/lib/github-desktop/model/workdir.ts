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

import {DiffSelection} from './diff/diff-selection';
import {AppFileStatus, FileChange} from './status';


export interface WorkDirStatus {
  unstaged: WorkingDirectoryFileChange[];
  staged: WorkingDirectoryFileChange[];
}

/** encapsulate the changes to a file in the working directory */
export class WorkingDirectoryFileChange extends FileChange {
  /**
   * @param path The relative path to the file in the repository.
   * @param status The status of the change to the file.
   * @param selection Contains the selection details for this file - all, nothing or partial.
   * @param staged
   */
  public constructor(
    path: string,
    status: AppFileStatus,
    public readonly selection?: DiffSelection,
    public readonly staged = false,
  ) {
    super(path, status);
  }

  /** Create a new WorkingDirectoryFileChange with the given includedness. */
  public withIncludeAll(include: boolean): WorkingDirectoryFileChange {
    const newSelection = include
      ? this.selection?.withSelectAll()
      : this.selection?.withSelectNone();

    return this.withSelection(newSelection);
  }

  /** Create a new WorkingDirectoryFileChange with the given diff selection. */
  public withSelection(selection?: DiffSelection): WorkingDirectoryFileChange {
    return new WorkingDirectoryFileChange(this.path, this.status, selection, this.staged);
  }
}
