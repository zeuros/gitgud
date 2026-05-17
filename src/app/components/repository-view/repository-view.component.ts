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

import {ChangeDetectionStrategy, Component, effect, ElementRef, inject, signal, viewChild} from '@angular/core';
import {LeftPanelComponent} from '../left-panel/left-panel.component';
import {SplitterModule} from 'primeng/splitter';
import {CommitSectionComponent} from '../commit-section/commit-section.component';
import {LogsComponent} from '../logs/logs.component';
import {FileDiffPanelService} from '../../services/file-diff-panel.service';
import {AsyncPipe} from '@angular/common';
import {MonacoEditorViewComponent} from '../monaco-editor-view/monaco-editor-view.component';
import {MergeEditorComponent} from '../merge-editor/merge-editor.component';
import {CurrentRepoStore} from '../../stores/current-repo.store';

@Component({
  selector: 'gitgud-repository-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  protected editorRightPx = signal(0);

  private commitPanel = viewChild('commitPanel', {read: ElementRef});

  constructor() {
    effect((onCleanup) => {
      const el: HTMLElement | undefined = this.commitPanel()?.nativeElement;
      if (!el) return;
      const ro = new ResizeObserver(() => this.editorRightPx.set(el.getBoundingClientRect().left - 4)); // 4 for accessing the splitter resize handle
      ro.observe(el);
      onCleanup(() => ro.disconnect());
    });
  }
}
