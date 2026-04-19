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

import {Component, effect, inject, signal} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {directory, fileName} from '../../../utils/utils';
import {ChangeSet} from '../../../lib/github-desktop/model/change-set';
import {CurrentRepoStore} from '../../../stores/current-repo.store';
import {FileDiffService} from '../../../services/file-diff.service';
import {CommitCardComponent} from '../commit-line/commit-card.component';
import {Divider} from 'primeng/divider';
import {CommitFileListComponent} from '../commit-file-list/commit-file-list';

@Component({
  selector: 'gitgud-commits-file-list-info',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    CommitCardComponent,
    Divider,
    CommitFileListComponent,
  ],
  templateUrl: './commits-file-list-info.component.html',
  standalone: true,
  host: {
    class: 'fill-height',
  },
})
export class CommitsFileListInfoComponent {
  protected editedFiles = signal<ChangeSet | undefined>(undefined);

  protected directory = directory;
  protected fileName = fileName;

  protected currentRepo = inject(CurrentRepoStore);
  private fileDiff = inject(FileDiffService);

  constructor() {
    effect(() => {
      const selectedCommits = this.currentRepo.selectedCommits();

      if (selectedCommits && selectedCommits.length > 1) {
        this.fileDiff.getChangedFilesForGivenCommits(selectedCommits.map(c => c.sha))
          .subscribe(editedFiles => this.editedFiles.set(editedFiles));
      }
    });
  }

}