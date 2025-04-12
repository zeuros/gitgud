import {AppFileStatus, AppFileStatusKind} from "./status";

export interface ChangeSet {
  /** Files changed in the changeset. */
  readonly files: ReadonlyArray<CommittedFileChange>

  /** Number of lines added in the changeset. */
  readonly linesAdded: number

  /** Number of lines deleted in the changeset. */
  readonly linesDeleted: number
}


/** encapsulate changes to a file associated with a commit */
export class FileChange {

  public readonly id: string

  /**
   * @param path The relative path to the file in the repository.
   * @param status The status of the change to the file.
   */
  public constructor(
    public readonly path: string,
    public readonly status: AppFileStatus
  ) {
    if (status.kind === AppFileStatusKind.Renamed || status.kind === AppFileStatusKind.Copied)
      this.id = `${status.kind}+${path}+${status.oldPath}`
    else
      this.id = `${status.kind}+${path}`
  }
}

/**
 * An object encapsulating the changes to a committed file.
 *
 * @param status A commit SHA or some other identifier that ultimately
 *               dereferences to a commit. This is the pointer to the
 *               'after' version of this change. I.e. the parent of this
 *               commit will contain the 'before' (or nothing, if the
 *               file change represents a new file).
 */
export class CommittedFileChange extends FileChange {
  public constructor(
    path: string,
    status: AppFileStatus,
    public readonly commitish: string
  ) {
    super(path, status)

    this.commitish = commitish
  }
}