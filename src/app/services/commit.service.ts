import {inject, Injectable} from '@angular/core';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {GitRepositoryStore} from '../stores/git-repos.store';
import {map, switchMap} from 'rxjs';
import {workingDirHasChanges} from '../utils/utils';
import {GitRefreshService} from './git-refresh.service';
import {FileDiffPanelService} from './file-diff-panel.service';

@Injectable({providedIn: 'root'})
export class CommitService {

  private readonly gitApi = inject(GitApiService);
  private readonly gitRefresh = inject(GitRefreshService);
  private readonly gitRepositoryStore = inject(GitRepositoryStore);
  private readonly fileDiffPanel = inject(FileDiffPanelService);

  commit = (summary: string, description?: string, amend = false) =>
    this.gitApi.git(['commit', ...(amend ? ['--amend'] : []), '-m', summary, ...(description ? ['-m', description] : [])])
      .pipe(switchMap(this.gitRefresh.refreshBranchesAndLogs))
      .subscribe(({workDirStatus}) => {
        this.fileDiffPanel.close();
        if (!workingDirHasChanges(workDirStatus))
          this.headSha().subscribe(sha => this.gitRepositoryStore.updateSelectedRepository({selectedCommitsShas: [sha]}));
      });

  private headSha = () => this.gitApi.git(['rev-parse', 'HEAD']).pipe(map(sha => sha.trim()));
}