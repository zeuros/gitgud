/** The union of potential states associated with a file change in Desktop */
export type AppFileStatus = {kind: AppFileStatusKind, oldPath?: string}


/**
 * Normal changes to a repository detected
 */
export type PlainFileStatus = {
  kind:
    | AppFileStatusKind.New
    | AppFileStatusKind.Modified
    | AppFileStatusKind.Deleted
}

/**
 * Copied or renamed files are change staged in the index that have a source
 * as well as a destination.
 *
 * The `oldPath` of a copied file also exists in the working directory, but the
 * `oldPath` of a renamed file will be missing from the working directory.
 */
export type CopiedOrRenamedFileStatus = {
  kind: AppFileStatusKind.Copied | AppFileStatusKind.Renamed
  oldPath: string
}

/**
 * Details about a file marked as conflicted in the index which needs to be
 * resolved manually by the user.
 */
export type ManualConflict = {
  kind: AppFileStatusKind.Conflicted
}

/**
 * Valid Git index states where the user needs to choose one of `us` or `them`
 * in the app.
 */
type ManualConflictDetails = {
  /** the submodule status for this entry */
  readonly submoduleStatus?: SubmoduleStatus
} & (
  | {
      readonly action: UnmergedEntrySummary.BothAdded
      readonly us: GitStatusEntry.Added
      readonly them: GitStatusEntry.Added
    }
  | {
      readonly action: UnmergedEntrySummary.BothModified
      readonly us: GitStatusEntry.UpdatedButUnmerged
      readonly them: GitStatusEntry.UpdatedButUnmerged
    }
  | {
      readonly action: UnmergedEntrySummary.AddedByUs
      readonly us: GitStatusEntry.Added
      readonly them: GitStatusEntry.UpdatedButUnmerged
    }
  | {
      readonly action: UnmergedEntrySummary.DeletedByThem
      readonly us: GitStatusEntry.UpdatedButUnmerged
      readonly them: GitStatusEntry.Deleted
    }
  | {
      readonly action: UnmergedEntrySummary.AddedByThem
      readonly us: GitStatusEntry.UpdatedButUnmerged
      readonly them: GitStatusEntry.Added
    }
  | {
      readonly action: UnmergedEntrySummary.DeletedByUs
      readonly us: GitStatusEntry.Deleted
      readonly them: GitStatusEntry.UpdatedButUnmerged
    }
  | {
      readonly action: UnmergedEntrySummary.BothDeleted
      readonly us: GitStatusEntry.Deleted
      readonly them: GitStatusEntry.Deleted
    }
)


type ManualConflictEntry = {
  readonly kind: 'conflicted'
  /** the submodule status for this entry */
  readonly submoduleStatus?: SubmoduleStatus
} & ManualConflictDetails

/** Union of potential conflict scenarios the application should handle */
export type ConflictedFileStatus = ConflictsWithMarkers | ManualConflict

/**
 * Details about a file marked as conflicted in the index which may have
 * conflict markers to inspect.
 */
export type ConflictsWithMarkers = {
  kind: AppFileStatusKind.Conflicted
  entry: TextConflictEntry
  conflictMarkerCount: number
  submoduleStatus?: SubmoduleStatus
}


type TextConflictEntry = {
  readonly kind: 'conflicted'
  /** the submodule status for this entry */
  readonly submoduleStatus?: SubmoduleStatus
} & TextConflictDetails


/**
 * The status entry code as reported by Git.
 */
export enum GitStatusEntry {
  Modified = 'M',
  Added = 'A',
  Deleted = 'D',
  Renamed = 'R',
  Copied = 'C',
  Unchanged = '.',
  Untracked = '?',
  Ignored = '!',
  UpdatedButUnmerged = 'U',
}

/**
 * Valid Git index states that the application should detect text conflict
 * markers
 */
type TextConflictDetails =
  | {
      readonly action: UnmergedEntrySummary.BothAdded
      readonly us: GitStatusEntry.Added
      readonly them: GitStatusEntry.Added
    }
  | {
      readonly action: UnmergedEntrySummary.BothModified
      readonly us: GitStatusEntry.UpdatedButUnmerged
      readonly them: GitStatusEntry.UpdatedButUnmerged
    }


export enum UnmergedEntrySummary {
  AddedByUs = 'added-by-us',
  DeletedByUs = 'deleted-by-us',
  AddedByThem = 'added-by-them',
  DeletedByThem = 'deleted-by-them',
  BothDeleted = 'both-deleted',
  BothAdded = 'both-added',
  BothModified = 'both-modified',
}

/** Denotes an untracked file in the working directory) */
export type UntrackedFileStatus = {
  kind: AppFileStatusKind.Untracked
  submoduleStatus?: SubmoduleStatus
}

/** The status of a submodule */
export type SubmoduleStatus = {
  /** Whether or not the submodule is pointing to a different commit */
  readonly commitChanged: boolean
  /**
   * Whether or not the submodule contains modified changes that haven't been
   * committed yet
   */
  readonly modifiedChanges: boolean
  /**
   * Whether or not the submodule contains untracked changes that haven't been
   * committed yet
   */
  readonly untrackedChanges: boolean
}


/** The enum representation of a Git file change. */
export enum AppFileStatusKind {
  New = 'New',
  Modified = 'Modified',
  Deleted = 'Deleted',
  Copied = 'Copied',
  Renamed = 'Renamed',
  Conflicted = 'Conflicted',
  Untracked = 'Untracked',
}