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

import {type ChangeSet} from '../model/change-set';
import {AppFileStatusKind, CommittedFileChange} from '../model/status';


export const mergeChangeSets = (changeSets: ChangeSet[]): ChangeSet => {
    const fileMap = new Map<string, CommittedFileChange>();

    // Merge all files across commits
    changeSets.forEach(changeSet => {
      changeSet.files.forEach(file => {
        const existing = fileMap.get(file.path);

        if (!existing) {
          fileMap.set(file.path, file);
        } else {
          // Merge status logic
          const oldStatus = existing.status.kind;
          const newStatus = file.status.kind;

          // If file was added then deleted across commits, remove it
          if (oldStatus === AppFileStatusKind.New && newStatus === AppFileStatusKind.Deleted) {
            fileMap.delete(file.path);
            return;
          }

          // If file was added, keep it as added (not modified)
          if (oldStatus === AppFileStatusKind.New && newStatus === AppFileStatusKind.Modified) {
            // Keep existing (already has parentCommitish)
          }
          // Otherwise use latest status
          else {
            fileMap.set(file.path, file);
          }
        }
      });
    });

    return {
      files: Array.from(fileMap.values()),
      kind: 'committed',
      linesAdded: 0,
      linesDeleted: 0,
    };
  };