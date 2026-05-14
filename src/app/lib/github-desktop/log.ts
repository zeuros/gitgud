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

import {type AppFileStatus, AppFileStatusKind} from "./model/status";


/**
 * Map the raw status text from Git to an app-friendly value
 * shamelessly borrowed from GitHub Desktop (Windows)
 */
export const mapStatus = (rawStatus: string, oldPath?: string): AppFileStatusKind => {
  const status = rawStatus.trim();

  if (status === 'M') return AppFileStatusKind.Modified;
  if (status === 'A') return AppFileStatusKind.New;
  if (status === '?') return AppFileStatusKind.Untracked;
  if (status === 'D') return AppFileStatusKind.Deleted;
  if (status === 'R' && oldPath != null) return AppFileStatusKind.Renamed;
  if (status === 'C' && oldPath != null) return AppFileStatusKind.Copied;

  // git log -M --name-status will return a RXXX - where XXX is a percentage
  if (RegExp(/R[0-9]+/).exec(status) && oldPath != null) return AppFileStatusKind.Renamed;

  // git log -C --name-status will return a CXXX - where XXX is a percentage
  if (RegExp(/C[0-9]+/).exec(status) && oldPath != null) return AppFileStatusKind.Copied;

  return AppFileStatusKind.Modified;
}

/**
 * Map the raw status text from Git to an app-friendly value for git status --porcelain output
 * @param rawStatus
 * @param oldPath
 */
export const mapPorcelainStatus = (rawStatus: string): AppFileStatusKind => {

  const stagedStatus = rawStatus.charAt(0);
  const unstagedStatus = rawStatus.charAt(1);

  // Staged statuses
  if (stagedStatus === 'A') return AppFileStatusKind.New;
  if (stagedStatus === 'M') return AppFileStatusKind.Modified;
  if (stagedStatus === 'D') return AppFileStatusKind.Deleted;
  if (stagedStatus === 'R') return AppFileStatusKind.Renamed;
  if (stagedStatus === 'C') return AppFileStatusKind.Copied;

  // Unstaged statuses
  if (unstagedStatus === 'M') return AppFileStatusKind.Modified;
  if (unstagedStatus === '?') return AppFileStatusKind.Untracked;

  // Default to Modified if the status is not recognized
  return AppFileStatusKind.Modified;
}

export const isCopyOrRename = (status: AppFileStatus) => [AppFileStatusKind.Copied, AppFileStatusKind.Renamed].includes(status.kind);


