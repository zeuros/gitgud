import {inject, Injectable} from '@angular/core';
import {map} from 'rxjs';
import {isStatusEntry, isStatusHeader, parsePorcelainStatus} from '../../lib/github-desktop/status-parser';
import {isMergeHeadSet} from '../../lib/github-desktop/merge';
import {conflictStatusCodes, WorkingDirectoryFileChange, WorkingDirectoryStatus} from '../../lib/github-desktop/model/status';
import {getConflictDetails} from '../../lib/github-desktop/status';
import {GitApiService} from './git-api.service';

@Injectable({
  providedIn: 'root',
})
export class StatusService {

  gitApiService = inject(GitApiService);

  /**
   *  Retrieve the status for a given repository,
   *  and fail gracefully if the location is not a Git repository
   */
  // getStatus = () =>
  //   this.gitApiService.git([
  //     '--no-optional-locks',
  //     'status',
  //     '--untracked-files=all',
  //     '--branch',
  //     '--porcelain=2',
  //     '-z',
  //   ]).pipe(map(statusRaw => {
  //     const parsed = parsePorcelainStatus(new Buffer(statusRaw))
  //     const headers = parsed.filter(isStatusHeader)
  //     const entries = parsed.filter(isStatusEntry)
  //
  //     const mergeHeadFound = isMergeHeadSet()
  //     const conflictedFilesInIndex = entries.filter(e => conflictStatusCodes.includes(e.statusCode))
  //     // const rebaseInternalState = await getRebaseInternalState(repository)
  //
  //     const conflictDetails = getConflictDetails(
  //       this.gitApiService.git,
  //       mergeHeadFound,
  //       conflictedFilesInIndex,
  //       rebaseInternalState
  //     )
  //
  //     // Map of files keyed on their paths.
  //     const files = entries.reduce(
  //       (files, entry) => buildStatusMap(files, entry, conflictDetails),
  //       new Map<string, WorkingDirectoryFileChange>()
  //     )
  //
  //     const {
  //       currentBranch,
  //       currentUpstreamBranch,
  //       currentTip,
  //       branchAheadBehind,
  //     } = headers.reduce(parseStatusHeader, {
  //       currentBranch: undefined,
  //       currentUpstreamBranch: undefined,
  //       currentTip: undefined,
  //       branchAheadBehind: undefined,
  //       match: null,
  //     })
  //
  //     const workingDirectory = WorkingDirectoryStatus.fromFiles([...files.values()])
  //
  //     const isCherryPickingHeadFound = await isCherryPickHeadFound(repository)
  //
  //     const squashMsgFound = await isSquashMsgSet(repository)
  //
  //     return {
  //       currentBranch,
  //       currentTip,
  //       currentUpstreamBranch,
  //       branchAheadBehind,
  //       exists: true,
  //       mergeHeadFound,
  //       rebaseInternalState,
  //       workingDirectory,
  //       isCherryPickingHeadFound,
  //       squashMsgFound,
  //       doConflictedFilesExist: conflictedFilesInIndex.length > 0,
  //     }
  //   }));

}

