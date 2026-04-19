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

import * as Path from "node:path";
import {RebaseInternalState} from "./model/rebase";
import { GitRepository } from "../../models/git-repository";

/**
 * Get the internal state about the rebase being performed on a repository. This
 * information is required to help Desktop display information to the user
 * about the current action as well as the options available.
 *
 * Returns `null` if no rebase is detected, or if the expected information
 * cannot be found in the repository.
 */
// export async function getRebaseInternalState(
//   repository: GitRepository
// ): Promise<RebaseInternalState | null> {
//   const isRebase = await isRebaseHeadSet(repository)
//
//   if (!isRebase) {
//     return null
//   }
//
//   let originalBranchTip: string | null = null
//   let targetBranch: string | null = null
//   let baseBranchTip: string | null = null
//
//   try {
//     originalBranchTip = await readFile(
//       Path.join(repository.path, '.git', 'rebase-merge', 'orig-head'),
//       'utf8'
//     )
//
//     originalBranchTip = originalBranchTip.trim()
//
//     targetBranch = await readFile(
//       Path.join(repository.path, '.git', 'rebase-merge', 'head-name'),
//       'utf8'
//     )
//
//     if (targetBranch.startsWith('refs/heads/')) {
//       targetBranch = targetBranch.substring(11).trim()
//     }
//
//     baseBranchTip = await readFile(
//       Path.join(repository.path, '.git', 'rebase-merge', 'onto'),
//       'utf8'
//     )
//
//     baseBranchTip = baseBranchTip.trim()
//   } catch {}
//
//   if (
//     originalBranchTip != null &&
//     targetBranch != null &&
//     baseBranchTip != null
//   ) {
//     return { originalBranchTip, targetBranch, baseBranchTip }
//   }
//
//   // unable to resolve the rebase state of this repository
//
//   return null
// }