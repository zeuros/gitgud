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
import {CurrentRepoStore} from '../stores/current-repo.store';
import {type DisplayRef} from '../lib/github-desktop/model/display-ref';
import {RefType} from '../enums/ref-type.enum';

@Injectable({providedIn: 'root'})
export class ConflictService {

  private currentRepo = inject(CurrentRepoStore);

  /** Annotates the WIP commit in-place when a merge conflict is in progress. */
  markWorkDirCommitConflicted(displayLog: DisplayRef[]): void {
    const conflictCount = this.currentRepo.workDirStatus()?.conflicted.length ?? 0;
    if (conflictCount === 0 || displayLog[0]?.refType !== RefType.INDEX) return;

    const branch = this.currentRepo.headBranch()?.name ?? 'HEAD';
    displayLog[0].summary = `${conflictCount} file${conflictCount > 1 ? 's' : ''} conflict${conflictCount > 1 ? 's' : ''} — attempting to merge into ${branch}`;
    displayLog[0].highlight = 'conflict';
  }
}
