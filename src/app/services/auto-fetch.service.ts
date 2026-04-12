import {effect, inject, Injectable, signal, untracked} from '@angular/core';
import {GitRepositoryStore} from '../stores/git-repos.store';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {GitRepositoryService} from './git-repository.service';

@Injectable({
  providedIn: 'root',
})
export class AutoFetchService {

  private readonly gitRepository = inject(GitRepositoryService);
  private readonly gitApi = inject(GitApiService);
  private readonly gitRepositoryStore = inject(GitRepositoryStore);

  readonly lastFetchedAt = signal<number | undefined>(undefined);

  private intervalId?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(this.autoFetch, this.gitRepositoryStore.config().autoFetchInterval);
    });

    // Initialize last-fetched time from .git/FETCH_HEAD mtime when repo changes
    effect(() => {
      const cwd = this.gitApi.cwd();
      if (!cwd) return;
      const fetchHead = `${cwd}/.git/FETCH_HEAD`;
      untracked(() => this.lastFetchedAt.set(
        window.electron.fs.existsSync(fetchHead) ? window.electron.fs.mtimeMs(fetchHead) : undefined,
      ));
    });
  }

  private readonly autoFetch = () => {
    if (untracked(() => this.gitRepositoryStore.selectedRepository())) {
      this.gitApi.git(['fetch']).subscribe(() => {
        this.lastFetchedAt.set(Date.now());
        this.gitRepository.doUpdateLogsAndBranches();
      });
    }
  };

}
