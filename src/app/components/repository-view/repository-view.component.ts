import {Component, inject} from '@angular/core';
import {LeftPanelComponent} from '../left-panel/left-panel.component';
import {SplitterModule} from 'primeng/splitter';
import {CommitSectionComponent} from '../commit-section/commit-section.component';
import {LogsComponent} from '../logs/logs.component';
import {FileDiffPanelService} from '../../services/file-diff-panel.service';
import {AsyncPipe} from '@angular/common';
import {sum} from 'lodash-es';
import {MonacoEditorViewComponent} from '../monaco-editor-view/monaco-editor-view.component';
import {GitRepositoryStore} from '../../stores/git-repos.store';

@Component({
  selector: 'gitgud-repository-view',
  standalone: true,
  imports: [LeftPanelComponent, LogsComponent, CommitSectionComponent, SplitterModule, AsyncPipe, MonacoEditorViewComponent],
  templateUrl: './repository-view.component.html',
  styleUrl: './repository-view.component.scss',
})
export class RepositoryViewComponent {

  protected readonly gitRepositoryStore = inject(GitRepositoryStore);
  protected readonly fileDiffPanelService = inject(FileDiffPanelService);
  protected readonly sum = sum;
  protected readonly savePanelSizes = (panelSizes: (number | string)[]) =>
    this.gitRepositoryStore.updateSelectedRepository({panelSizes: panelSizes.map(Number)});
}
