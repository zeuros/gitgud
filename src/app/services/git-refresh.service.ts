import {inject, Injectable} from '@angular/core';
import {WorkingDirectoryService} from './electron-cmd-parser-layer/working-directory.service';
import {GitRepositoryService} from './git-repository.service';
import {forkJoin} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GitRefreshService {

  private workingDirectory = inject(WorkingDirectoryService);
  private gitRepository = inject(GitRepositoryService);

  doRefreshBranchesAndLogs = () => this.refreshBranchesAndLogs().subscribe();

  refreshBranchesAndLogs = () => forkJoin({
    workDirStatus: this.workingDirectory.fetchWorkingDirChanges(),
    logsAndBranches: this.gitRepository.updateLogsAndBranches(), // refresh log and wait for it so that selected commit sha can be updated
  });
}