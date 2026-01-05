import {Component, inject, input, Input} from '@angular/core';
import {LeftPanelComponent} from '../left-panel/left-panel.component';
import {SplitterModule} from 'primeng/splitter';
import {GitRepositoryService} from '../../services/git-repository.service';
import {CommitSectionComponent} from '../commit-section/commit-section.component';
import {LogsComponent} from '../logs/logs.component';
import {GitRepository} from '../../models/git-repository';
import {FileDiffPanelService} from '../../services/file-diff-panel.service';
import {AsyncPipe, NgIf} from '@angular/common';
import {sum} from 'lodash';
import {MonacoEditorViewComponent} from '../monaco-editor-view/monaco-editor-view.component';

@Component({
  selector: 'gitgud-repository-view',
  standalone: true,
  imports: [LeftPanelComponent, LogsComponent, CommitSectionComponent, SplitterModule, AsyncPipe, NgIf, MonacoEditorViewComponent],
  templateUrl: './repository-view.component.html',
  styleUrl: './repository-view.component.scss',
})
export class RepositoryViewComponent {

  gitRepository = input<GitRepository>();
  protected readonly fileDiffPanelService = inject(FileDiffPanelService);
  protected readonly sum = sum;
  private readonly gitRepositoryService = inject(GitRepositoryService);

  protected readonly savePanelSizes = (sizes: number[]) => this.gitRepositoryService.updateCurrentRepository({sizes});
}
