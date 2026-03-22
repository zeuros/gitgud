import {inject, Injectable} from '@angular/core';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {GitRepositoryService} from './git-repository.service';
import {GitRepositoryStore} from '../stores/git-repos.store';
import {forkJoin, map, switchMap, tap} from 'rxjs';
import {WorkingDirectoryService} from './electron-cmd-parser-layer/working-directory.service';
import { workingDirHasChanges } from '../utils/utils';

@Injectable({providedIn: 'root'})
export class CommitService {

  private readonly gitApi = inject(GitApiService);
  private readonly gitRepository = inject(GitRepositoryService);
  private readonly gitRepositoryStore = inject(GitRepositoryStore);
  private readonly workingDirectory = inject(WorkingDirectoryService);

  giveHead = () => this.gitApi.git(['rev-parse', 'HEAD']).pipe(map(sha => sha.trim()));

  commit = (summary: string, description?: string, amend = false) =>
    this.gitApi.git(['commit', ...(amend ? ['--amend'] : []), '-m', summary, ...(description ? ['-m', description] : [])])
      .pipe(
        switchMap(() => forkJoin({
          workDirStatus: this.workingDirectory.fetchWorkingDirChanges(),
          logsAndBranches: this.gitRepository.updateLogsAndBranches(), // refresh log and wait for it so that selected commit sha can be updated
        })),
      )
      .subscribe(({workDirStatus}) => {
        if(!workingDirHasChanges(workDirStatus))
          this.giveHead().subscribe(sha => this.gitRepositoryStore.updateSelectedRepository({selectedCommitsShas: [sha]}));
      });
}