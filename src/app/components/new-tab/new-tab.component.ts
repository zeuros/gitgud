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

import {ChangeDetectionStrategy, Component, inject, OnInit} from '@angular/core';
import {GitRepositoryService} from '../../services/git-repository.service';
import {GitRepositoryStore} from '../../stores/git-repos.store';
import {lastFolderName} from '../../utils/utils';
import {Button} from 'primeng/button';
import {DialogService} from 'primeng/dynamicdialog';
import {openCloneDialog} from '../dialogs/clone-dialog/clone-dialog.component';

@Component({
  selector: 'gitgud-new-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Button],
  templateUrl: './new-tab.component.html',
  styleUrl: './new-tab.component.scss',
  host: {class: 'fill-height'},
})
export class NewTabComponent implements OnInit {
  protected gitRepository = inject(GitRepositoryService);
  protected gitRepositoryStore = inject(GitRepositoryStore);
  private dialog = inject(DialogService);
  protected lastFolderName = lastFolderName;
  protected openClone = () => openCloneDialog(this.dialog);

  ngOnInit() {
    const ids = this.gitRepositoryStore.recentIds();
    Promise.all(ids.map(id => window.tauri.fs.exists(id).then(exists => ({id, exists}))))
      .then(results => results.filter(r => !r.exists).forEach(r => this.gitRepositoryStore.removeRecent(r.id)));
  }
}
