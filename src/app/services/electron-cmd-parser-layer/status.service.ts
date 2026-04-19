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

import {inject, Injectable} from '@angular/core';
import {GitApiService} from './git-api.service';

@Injectable({
  providedIn: 'root',
})
export class StatusService {

  gitApi = inject(GitApiService);

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

