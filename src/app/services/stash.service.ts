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
import {delay, map, Observable, switchMap, tap} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {workingDirHasChanges} from '../utils/utils';
import {CurrentRepoStore} from '../stores/current-repo.store';

@Injectable({
  providedIn: 'root',
})
export class StashService {
  private gitApi = inject(GitApiService);
  private currentRepo = inject(CurrentRepoStore);


  stashAndRun = <T>(operation$: Observable<T>, thenUnstash = true): Observable<T> => {

    if (!workingDirHasChanges(this.currentRepo.workDirStatus())) return operation$;

    const stashAndRun$ = this.gitApi.git(['stash', '-u']).pipe(tap(() => console.log('stashed')), delay(1), switchMap(() => operation$));

    // TODO: get stash sha, restore this exact same stash in the end ...
    return thenUnstash
      ? stashAndRun$.pipe(
        switchMap(r => this.gitApi.git(['stash', 'pop']).pipe(map(() => r))),
        // catchError(e => this.gitApiService.git(['stash', 'pop']).pipe(switchMap(() => throwError(() => e))))
      )
      : stashAndRun$;
  };

  stash = () => this.gitApi.git(['stash', '-u']);

  pop = () => this.gitApi.git(['stash', 'pop']);

  apply = (stashRef = 'stash@{0}') => this.gitApi.git(['stash', 'apply', stashRef]);

  drop = (stashRef = 'stash@{0}') => this.gitApi.git(['stash', 'drop', stashRef]);
}