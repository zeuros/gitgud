import {RebaseInternalState} from "./model/rebase"
import {
  AppFileStatus,
  AppFileStatusKind,
  ConflictedFileStatus,
  FileEntry,
  GitStatusEntry,
  UnmergedEntry,
  UnmergedEntrySummary,
  WorkingDirectoryFileChange,
  WorkingDirectoryStatus
} from "./model/status"
import {DiffSelection, DiffSelectionType} from "./model/diff/diff-selection"
import {IStatusEntry, mapStatus, StatusHeader} from "./status-parser"
import {IAheadBehind} from "./model/branch"
import {throwEx} from "../../utils/utils";
import {GitRepository} from "../../models/git-repository";
import {getFilesWithConflictMarkers} from "./diff-check";
import {catchError, forkJoin, Observable} from "rxjs"
import {getBinaryPaths} from "./diff"

/** The encapsulation of the result from 'git status' */
export interface IStatusResult {
  /** The name of the current branch */
  readonly currentBranch?: string

  /** The name of the current upstream branch */
  readonly currentUpstreamBranch?: string

  /** The SHA of the tip commit of the current branch */
  readonly currentTip?: string

  /** How many commits ahead and behind
   *  the `currentBranch` is compared to the `currentUpstreamBranch`
   */
  readonly branchAheadBehind?: IAheadBehind

  /** true if the repository exists at the given location */
  readonly exists: boolean

  /** true if repository is in a conflicted state */
  readonly mergeHeadFound: boolean

  /** true merge --squash operation started */
  readonly squashMsgFound: boolean

  /** details about the rebase operation, if found */
  readonly rebaseInternalState: RebaseInternalState | null

  /** true if repository is in cherry pick state */
  readonly isCherryPickingHeadFound: boolean

  /** the absolute path to the repository's working directory */
  readonly workingDirectory: WorkingDirectoryStatus

  /** whether conflicting files present on repository */
  readonly doConflictedFilesExist: boolean
}

interface IStatusHeadersData {
  currentBranch?: string
  currentUpstreamBranch?: string
  currentTip?: string
  branchAheadBehind?: IAheadBehind
  match: RegExpMatchArray | null
}

type ConflictFilesDetails = {
  conflictCountsByPath: Record<string, number>
  binaryFilePaths: ReadonlyArray<string>
}

// function parseConflictedState(
//   entry: UnmergedEntry,
//   path: string,
//   conflictDetails: ConflictFilesDetails
// ): ConflictedFileStatus {
//   switch (entry.action) {
//     case UnmergedEntrySummary.BothAdded: {
//       const isBinary = conflictDetails.binaryFilePaths.includes(path)
//       if (!isBinary) {
//         return {
//           kind: AppFileStatusKind.Conflicted,
//           entry,
//           conflictMarkerCount:
//             conflictDetails.conflictCountsByPath.get(path) || 0,
//         }
//       } else {
//         return {
//           kind: AppFileStatusKind.Conflicted,
//           entry,
//         }
//       }
//     }
//     case UnmergedEntrySummary.BothModified: {
//       const isBinary = conflictDetails.binaryFilePaths.includes(path)
//       if (!isBinary) {
//         return {
//           kind: AppFileStatusKind.Conflicted,
//           entry,
//           conflictMarkerCount:
//             conflictDetails.conflictCountsByPath.get(path) || 0,
//         }
//       } else {
//         return {
//           kind: AppFileStatusKind.Conflicted,
//           entry,
//         }
//       }
//     }
//     default:
//       return {
//         kind: AppFileStatusKind.Conflicted,
//         entry,
//       }
//   }
// }

// function convertToAppStatus(
//   path: string,
//   entry: FileEntry,
//   conflictDetails: ConflictFilesDetails,
//   oldPath?: string
// ): AppFileStatus {
//   if (entry.kind === 'ordinary') {
//     switch (entry.type) {
//       case 'added':
//         return {
//           kind: AppFileStatusKind.New,
//           submoduleStatus: entry.submoduleStatus,
//         }
//       case 'modified':
//         return {
//           kind: AppFileStatusKind.Modified,
//           submoduleStatus: entry.submoduleStatus,
//         }
//       case 'deleted':
//         return {
//           kind: AppFileStatusKind.Deleted,
//           submoduleStatus: entry.submoduleStatus,
//         }
//     }
//   } else if (entry.kind === 'copied' && oldPath != null) {
//     return {
//       kind: AppFileStatusKind.Copied,
//       oldPath,
//       submoduleStatus: entry.submoduleStatus,
//     }
//   } else if (entry.kind === 'renamed' && oldPath != null) {
//     return {
//       kind: AppFileStatusKind.Renamed,
//       oldPath,
//       submoduleStatus: entry.submoduleStatus,
//     }
//   } else if (entry.kind === 'untracked') {
//     return {
//       kind: AppFileStatusKind.Untracked,
//       submoduleStatus: entry.submoduleStatus,
//     }
//   } else if (entry.kind === 'conflicted') {
//     return parseConflictedState(entry, path, conflictDetails)
//   }
//
//   return throwEx(`Unknown file status ${status}`)
// }

// List of known conflicted index entries for a file, extracted from mapStatus
// inside `app/src/lib/status-parser.ts` for convenience
const conflictStatusCodes = ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']

/**
 *
 * Update map of working directory changes with a file status entry.
 * Reducer(ish).
 *
 * (Map is used here to maintain insertion order.)
 */
// function buildStatusMap(
//   files: Map<string, WorkingDirectoryFileChange>,
//   entry: IStatusEntry,
//   conflictDetails: ConflictFilesDetails
// ): Map<string, WorkingDirectoryFileChange> {
//   const status = mapStatus(entry.statusCode, entry.submoduleStatusCode)
//
//   if (status.kind === 'ordinary') {
//     // when a file is added in the index but then removed in the working
//     // directory, the file won't be part of the commit, so we can skip
//     // displaying this entry in the changes list
//     if (
//       status.index === GitStatusEntry.Added &&
//       status.workingTree === GitStatusEntry.Deleted
//     ) {
//       return files
//     }
//   }
//
//   if (status.kind === 'untracked') {
//     // when a delete has been staged, but an untracked file exists with the
//     // same path, we should ensure that we only draw one entry in the
//     // changes list - see if an entry already exists for this path and
//     // remove it if found
//     files.delete(entry.path)
//   }
//
//   // for now we just poke at the existing summary
//   const appStatus = convertToAppStatus(
//     entry.path,
//     status,
//     conflictDetails,
//     entry.oldPath
//   )
//
//   const initialSelectionType =
//     appStatus.kind === AppFileStatusKind.Modified &&
//     appStatus.submoduleStatus !== undefined &&
//     !appStatus.submoduleStatus.commitChanged
//       ? DiffSelectionType.None
//       : DiffSelectionType.All
//
//   const selection = DiffSelection.fromInitialSelection(initialSelectionType)
//
//   files.set(
//     entry.path,
//     new WorkingDirectoryFileChange(entry.path, appStatus, selection)
//   )
//   return files
// }

/**
 * Update status header based on the current header entry.
 * Reducer.
 */
function parseStatusHeader(results: IStatusHeadersData, header: StatusHeader) {
  let {
    currentBranch,
    currentUpstreamBranch,
    currentTip,
    branchAheadBehind,
    match,
  } = results
  const value = header.value

  // This intentionally does not match branch.oid initial
  if ((match = value.match(/^branch\.oid ([a-f0-9]+)$/))) {
    currentTip = match[1]
  } else if ((match = value.match(/^branch.head (.*)/))) {
    if (match[1] !== '(detached)') {
      currentBranch = match[1]
    }
  } else if ((match = value.match(/^branch.upstream (.*)/))) {
    currentUpstreamBranch = match[1]
  } else if ((match = value.match(/^branch.ab \+(\d+) -(\d+)$/))) {
    const ahead = parseInt(match[1], 10)
    const behind = parseInt(match[2], 10)

    if (!isNaN(ahead) && !isNaN(behind)) {
      branchAheadBehind = {ahead, behind}
    }
  }
  return {
    currentBranch,
    currentUpstreamBranch,
    currentTip,
    branchAheadBehind,
    match,
  }
}

const getMergeConflictDetails =
  (git: (args?: string[]) => Observable<string>, conflictedFilesInIndex: ReadonlyArray<IStatusEntry>): Observable<ConflictFilesDetails> =>
    forkJoin({
      conflictCountsByPath: getFilesWithConflictMarkers(git),
      binaryFilePaths: getBinaryPaths(git, 'MERGE_HEAD', conflictedFilesInIndex)
    });

const getRebaseConflictDetails =
  (git: (args?: string[]) => Observable<string>, conflictedFilesInIndex: ReadonlyArray<IStatusEntry>): Observable<ConflictFilesDetails> =>
    forkJoin({
      conflictCountsByPath: getFilesWithConflictMarkers(git),
      binaryFilePaths: getBinaryPaths(git, 'REBASE_HEAD', conflictedFilesInIndex)
    });

/**
 * We need to do these operations to detect conflicts that were the result
 * of popping a stash into the index
 */
const getWorkingDirectoryConflictDetails =
  (git: (args?: string[]) => Observable<string>, conflictedFilesInIndex: ReadonlyArray<IStatusEntry>): Observable<ConflictFilesDetails> =>
    forkJoin({
      conflictCountsByPath: getFilesWithConflictMarkers(git),
      binaryFilePaths: getBinaryPaths(git, 'HEAD', conflictedFilesInIndex),
    })
      .pipe(catchError((e, caught) => {
        console.warn(e); // its totally fine if HEAD doesn't exist, which throws an error
        return caught
      }))

/**
 * gets the conflicted files count and binary file paths in a given repository.
 * for computing an `IStatusResult`.
 *
 * @param repository to get details from
 * @param mergeHeadFound whether a merge conflict has been detected
 * @param conflictedFilesInIndex all files marked as being conflicted in the
 *                               index. Used to check for files using the binary
 *                               merge driver and whether it looks like a stash
 *                               has introduced conflicts
 * @param rebaseInternalState details about the current rebase operation (if
 * found)
 */
export const getConflictDetails = (
  git: (args?: string[]) => Observable<string>,
  mergeHeadFound: boolean,
  conflictedFilesInIndex: ReadonlyArray<IStatusEntry>,
  rebaseInternalState: RebaseInternalState | null
) => {
  if (mergeHeadFound) {
    return getMergeConflictDetails(git, conflictedFilesInIndex)
  }

  if (rebaseInternalState !== null) {
    return getRebaseConflictDetails(git, conflictedFilesInIndex)
  }

  // If there's conflicted files in the index but we don't have a merge head
  // or a rebase internal state, then we're likely in a situation where a
  // stash has introduced conflicts
  if (conflictedFilesInIndex.length > 0) {
    return getWorkingDirectoryConflictDetails(git, conflictedFilesInIndex)
  }

  throw new Error('')
}

