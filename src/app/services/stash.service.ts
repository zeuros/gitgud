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
import {map, type Observable, of, switchMap, throwError} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {workingDirHasChanges} from '../utils/utils';
import {short} from '../utils/commit-utils';
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
      switchMap(prevSha => this.gitApi.git(['stash', '-u']).pipe(
        switchMap(() => this.topStashSha$),
        // `git stash -u` makes no stash when there turned out to be nothing to save
        map(newSha => newSha !== prevSha ? newSha : undefined),
      )),
      switchMap(ownSha => operation$.pipe( // do action
        switchMap(r => thenUnstash && ownSha ? this.popStashBySha(ownSha).pipe(map(() => r)) : of(r)), // unstash
      )),
    );
  };

  stash = () => this.gitApi.gitAction(['stash', '-u']);

  pop = () => this.gitApi.gitAction(['stash', 'pop']);

  apply = (stashRef = 'stash@{0}') => this.gitApi.gitAction(['stash', 'apply', stashRef]);

  drop = (stashRef = 'stash@{0}') => this.gitApi.gitAction(['stash', 'drop', stashRef]);

  // Pops the stash stashAndRun created, by its sha: other stashes may have been pushed or dropped since
  private popStashBySha = (sha: string) =>
    this.gitApi.git(['stash', 'list', '--format=%H']).pipe(
      map(list => list.trim().split('\n').indexOf(sha)),
      switchMap(index => index == -1
        ? throwError(() => new Error(`The stash ${short(sha)} holding your changes is gone, no other stash was popped`))
        : this.gitApi.git(['stash', 'pop', `stash@{${index}}`])),
    );
}