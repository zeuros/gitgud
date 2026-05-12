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

import {Component, inject} from '@angular/core';
import {LeftPanelComponent} from '../left-panel/left-panel.component';
import {SplitterModule, SplitterResizeEndEvent} from 'primeng/splitter';
import {CommitSectionComponent} from '../commit-section/commit-section.component';
import {LogsComponent} from '../logs/logs.component';
import {FileDiffPanelService} from '../../services/file-diff-panel.service';
import {AsyncPipe} from '@angular/common';
import {sum} from 'lodash-es';
import {MonacoEditorViewComponent} from '../monaco-editor-view/monaco-editor-view.component';
import {MergeEditorComponent} from '../merge-editor/merge-editor.component';
import {CurrentRepoStore} from '../../stores/current-repo.store';

@Component({
  selector: 'gitgud-repository-view',
  standalone: true,
  imports: [LeftPanelComponent, LogsComponent, CommitSectionComponent, SplitterModule, AsyncPipe, MonacoEditorViewComponent, MergeEditorComponent],
  templateUrl: './repository-view.component.html',
  styleUrl: './repository-view.component.scss',
  host: {
    class: 'fill-height',
  },
})
export class RepositoryViewComponent {

  protected currentRepo = inject(CurrentRepoStore);
  protected fileDiffPanel = inject(FileDiffPanelService);
  protected sum = sum;
  protected savePanelSizes = ({sizes}: SplitterResizeEndEvent) =>
    this.currentRepo.update({panelSizes: {...this.currentRepo.panelSizes()!, mainPanels: sizes.map(Number)}});
}
