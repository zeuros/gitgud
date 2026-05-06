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
import {catchError, from, map, mergeMap, Observable, of} from 'rxjs';
import {AheadBehind, Branch, BranchType} from '../lib/github-desktop/model/branch';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {AutoFetchService} from './auto-fetch.service';

@Injectable({providedIn: 'root'})
export class BranchAheadBehindService {
  private gitApi = inject(GitApiService);
  private currentRepo = inject(CurrentRepoStore);
  private autoFetch = inject(AutoFetchService);

  /** Ahead/behind counts keyed by local branch name. Only branches with a tracked upstream are present. */
  readonly aheadBehindMap = signal<Record<string, AheadBehind>>({});

  constructor() {
    effect(() => {
      this.autoFetch.lastFetchedAt(); // Update every branch up / down diff count after every fetch

      const localTrackedBranches = this.currentRepo.branches().filter(b => b.type === BranchType.Local && b.upstream);

      from(localTrackedBranches)
        .pipe(mergeMap(this.fetchForBranch))
        .subscribe(([branch, aheadBehind]) => this.aheadBehindMap.update(map => ({...map, [branch]: aheadBehind})));
    });
  }

  /** One-shot ahead/behind for HEAD vs its upstream — used by toolbar before push. */
  aheadBehindForHead = () =>
    this.gitApi.git(['rev-list', '--count', '--left-right', 'HEAD...@{u}']).pipe(
      map(out => {
        const [ahead, behind] = out.trim().split('\t').map(Number);
        return {ahead, behind, diverged: ahead > 0 && behind > 0};
      }),
      catchError(() => of({ahead: 0, behind: 0, diverged: false})),
    );

  private fetchForBranch = (branch: Branch): Observable<[string, AheadBehind]> =>
    this.gitApi.git(['rev-list', '--count', '--left-right', `${branch.ref}...refs/remotes/${branch.upstream}`]).pipe(
      map(out => {
        const [ahead, behind] = out.trim().split('\t').map(Number);
        return [branch.name, {ahead, behind}];
      }),
    );
}
