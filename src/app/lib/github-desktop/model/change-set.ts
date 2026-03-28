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