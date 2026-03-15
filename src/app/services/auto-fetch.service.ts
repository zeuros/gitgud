import {effect, inject, Injectable, untracked} from '@angular/core';
import {GitRepositoryStore} from '../stores/git-repos.store';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {GitRepositoryService} from './git-repository.service';

@Injectable({
  providedIn: 'root',
})
export class AutoFetchService {

  private readonly gitRepositoryService = inject(GitRepositoryService);
  private readonly gitApiService = inject(GitApiService);
  private readonly gitRepositoryStore = inject(GitRepositoryStore);

  private intervalId?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(this.autoFetch, this.gitRepositoryStore.config().autoFetchInterval);
    });
  }

  // TODO: auto fetch only if no other programs have done it (stat .git/FETCH_HEAD to know that)
  private readonly autoFetch = () => {
    if (untracked(() => this.gitRepositoryStore.selectedRepository())) {
      this.gitApiService.git(['fetch']);
      this.gitRepositoryService.doUpdateLogsAndBranches();
    }
  };

}
