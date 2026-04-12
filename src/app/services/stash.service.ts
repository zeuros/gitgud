import {inject, Injectable} from '@angular/core';
import {delay, Observable, switchMap, tap} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {workingDirHasChanges} from '../utils/utils';
import {CurrentRepoStore} from '../stores/current-repo.store';

@Injectable({
  providedIn: 'root',
})
export class StashService {
  private readonly gitApi = inject(GitApiService);
  private readonly currentRepo = inject(CurrentRepoStore);


  stashAndRun = (operation$: Observable<unknown>, thenUnstash = true): Observable<unknown> => {

    if (!workingDirHasChanges(this.currentRepo.workDirStatus())) return operation$;

    const stashAndRun$ = this.gitApi.git(['stash', '-u']).pipe(tap(() => console.log('stashed')), delay(1), switchMap(() => operation$));

    // TODO: get stash sha, restore this exact same stash in the end ...
    return thenUnstash
      ? stashAndRun$.pipe(
        switchMap(() => this.gitApi.git(['stash', 'pop'])),
        // catchError(e => this.gitApiService.git(['stash', 'pop']).pipe(switchMap(() => throwError(() => e))))
      )
      : stashAndRun$;
  };

  stash = () => this.gitApi.git(['stash', '-u']);

  pop = () => this.gitApi.git(['stash', 'pop']);

  apply = (stashRef = 'stash@{0}') => this.gitApi.git(['stash', 'apply', stashRef]);

  drop = (stashRef = 'stash@{0}') => this.gitApi.git(['stash', 'drop', stashRef]);
}