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

import {effect, inject, Injectable, signal} from '@angular/core';
import {catchError, EMPTY, from, map, mergeMap, type Observable, toArray} from 'rxjs';
import type {AheadBehind, Branch} from '../lib/github-desktop/model/branch';
import {local} from '../utils/branch-utils';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {GitApiService} from './git/git-api.service';
import {AutoFetchService} from './auto-fetch.service';

@Injectable({providedIn: 'root'})
export class BranchAheadBehindService {
  private gitApi = inject(GitApiService);
  private currentRepo = inject(CurrentRepoStore);
  private autoFetch = inject(AutoFetchService);

  /** Ahead/behind counts keyed by local branch name. Only branches with a tracked upstream are present. */
  aheadBehindMap = signal<Record<string, AheadBehind>>({});

  constructor() {
    effect((onCleanup) => {
      this.autoFetch.lastFetchedAt(); // Update every branch up / down diff count after every fetch

      const localTrackedBranches = this.currentRepo.branches().filter(b => local(b) && b.upstream);

      // Replaces the whole map: branches of the previously selected repository, or gone, keep no count
      const sub = from(localTrackedBranches)
        .pipe(mergeMap(this.aheadBehindCountsForBranch), toArray())
        .subscribe(counts => this.aheadBehindMap.set(Object.fromEntries(counts)));
      onCleanup(() => sub.unsubscribe());
    });
  }

  /** Commits `ref` has that `otherRef` lacks (ahead), and the reverse (behind). Errors when either ref doesn't exist. */
  aheadBehind = (ref: string, otherRef: string) =>
    this.gitApi.git(['rev-list', '--count', '--left-right', `${ref}...${otherRef}`]).pipe(
      map(out => {
        const [ahead, behind] = out.trim().split('\t').map(Number);
        return {ahead, behind, diverged: ahead > 0 && behind > 0};
      }),
    );

  private aheadBehindCountsForBranch = (branch: Branch): Observable<[string, AheadBehind]> =>
    this.aheadBehind(branch.ref, `refs/remotes/${branch.upstream}`).pipe(
      map(({ahead, behind}): [string, AheadBehind] => [branch.name, {ahead, behind}]),
      // If remote branch doesn't exist, git throws an error, which can be silenced
      catchError(() => EMPTY),
    );
}
