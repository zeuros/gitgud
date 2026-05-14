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
import {map, Observable, of, switchMap} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {workingDirHasChanges} from '../utils/utils';
import {CurrentRepoStore} from '../stores/current-repo.store';

@Injectable({
  providedIn: 'root',
})
export class StashService {
  private gitApi = inject(GitApiService);
  private currentRepo = inject(CurrentRepoStore);


  private topStashSha$ = this.gitApi.git(['stash', 'list', '--format=%H', '-1']).pipe(map(s => s.trim()));

  stashAndRun = <T>(operation$: Observable<T>, thenUnstash = true): Observable<T> => {
    // Stash
    if (!workingDirHasChanges(this.currentRepo.workDirStatus())) return operation$;

    return this.topStashSha$.pipe(
      switchMap(prevSha =>
        this.gitApi.git(['stash', '-u']).pipe(
          switchMap(() => operation$), // do action
          switchMap(r => thenUnstash ? this.popIfNewStash(prevSha).pipe(map(() => r)) : of(r)), // unstash
        ),
      ),
    );
  };

  stash = () => this.gitApi.git(['stash', '-u']);

  pop = () => this.gitApi.git(['stash', 'pop']);

  apply = (stashRef = 'stash@{0}') => this.gitApi.git(['stash', 'apply', stashRef]);

  drop = (stashRef = 'stash@{0}') => this.gitApi.git(['stash', 'drop', stashRef]);

  private popIfNewStash = (prevSha: string) =>
    this.topStashSha$.pipe(
      switchMap(newSha => newSha !== prevSha ? this.gitApi.git(['stash', 'pop']) : of(null)),
    );
}