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
import {Tab, TabList, TabPanel, TabPanels, Tabs} from 'primeng/tabs';
import {Button} from 'primeng/button';
import {RepositoryViewComponent} from '../repository-view/repository-view.component';
import {GitRepositoryStore} from '../../stores/git-repos.store';
import {GitRepositoryService} from '../../services/git-repository.service';
import {ToolbarComponent} from '../toolbar/toolbar.component';
import {CdkDrag, CdkDragDrop, CdkDropList} from '@angular/cdk/drag-drop';

@Component({
  selector: 'gitgud-repositories-view',
  imports: [
    Tabs,
    TabList,
    Tab,
    Button,
    TabPanels,
    TabPanel,
    RepositoryViewComponent,
    ToolbarComponent,
    CdkDropList,
    CdkDrag,
  ],
  templateUrl: './repositories-view.component.html',
  styleUrl: './repositories-view.component.scss',
  host: {
    class: 'fill-height',
  },
})
export class RepositoriesViewComponent {
  protected gitRepositoryStore = inject(GitRepositoryStore);
  protected gitRepositoryService = inject(GitRepositoryService);

  protected drop({previousIndex, currentIndex}: CdkDragDrop<string[]>): void {
    this.gitRepositoryStore.reorderRepositories(previousIndex, currentIndex);
  }

  protected onMiddleClick(event: MouseEvent, index: number): void {
    if (event.button === 1) {
      event.preventDefault();
      this.gitRepositoryStore.removeRepository(index);
    }
  }
}
