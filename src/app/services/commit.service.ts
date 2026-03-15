import {inject, Injectable} from '@angular/core';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {GitRepositoryService} from './git-repository.service';
import {GitRepositoryStore} from '../stores/git-repos.store';
import {forkJoin, map, switchMap, tap} from 'rxjs';
import {WorkingDirectoryService} from './electron-cmd-parser-layer/working-directory.service';
import { workingDirHasChanges } from '../utils/utils';

@Injectable({providedIn: 'root'})
export class CommitService {

  private readonly gitApiService = inject(GitApiService);
  private readonly gitRepositoryService = inject(GitRepositoryService);
  private readonly gitRepositoryStore = inject(GitRepositoryStore);
  private readonly workingDirectoryService = inject(WorkingDirectoryService);

  giveHead = () => this.gitApiService.git(['rev-parse', 'HEAD']).pipe(map(sha => sha.trim()));

  commit = (summary: string, description?: string, amend = false) =>
    this.gitApiService.git(['commit', ...(amend ? ['--amend'] : []), '-m', summary, ...(description ? ['-m', description] : [])])
      .pipe(
        switchMap(() => forkJoin({
          workDirStatus: this.workingDirectoryService.fetchWorkingDirChanges(),
          logsAndBranches: this.gitRepositoryService.updateLogsAndBranches(), // refresh log and wait for it so that selected commit sha can be updated
        })),
      )
      .subscribe(({workDirStatus}) => {
        if(!workingDirHasChanges(workDirStatus))
          this.giveHead().subscribe(sha => this.gitRepositoryStore.updateSelectedRepository({selectedCommitsShas: [sha]}));
      });
}