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
   */
  public constructor(
    path: string,
    status: AppFileStatus,
    public readonly selection?: DiffSelection,
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
    return new WorkingDirectoryFileChange(this.path, this.status, selection);
  }
}
