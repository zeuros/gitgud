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

import {ChangeDetectionStrategy, Component, computed, effect, inject, signal} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {directory, fileName} from '../../../utils/utils';
import type {ChangeSet} from '../../../lib/github-desktop/model/change-set';
import {CurrentRepoStore} from '../../../stores/current-repo.store';
import {FileDiffService} from '../../../services/file-diff.service';
import {AvatarComponent} from '../commit-infos/avatar/avatar.component';
import type {CommitIdentity} from '../../../lib/github-desktop/model/commit-identity';
import {Tooltip} from 'primeng/tooltip';
import {Divider} from 'primeng/divider';
import {CommitsTimelineComponent} from '../commits-timeline/commits-timeline.component';
import {CommitFileListComponent} from '../commit-file-list/commit-file-list';

const MAX_AVATARS = 5;
const MAX_NAMES = 2;

@Component({
  selector: 'gitgud-commits-file-list-info',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    AvatarComponent,
    Tooltip,
    CommitsTimelineComponent,
    Divider,
    CommitFileListComponent,
  ],
  templateUrl: './commits-file-list-info.component.html',
  styleUrl: './commits-file-list-info.component.scss',
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

  // One entry per author of the selected commits, the most prolific first
  protected authors = computed(() => {
    const byEmail = new Map<string, {identity: CommitIdentity, commits: number}>();
    for (const {author} of this.currentRepo.selectedCommits()) {
      const known = byEmail.get(author.email);
      if (known) known.commits++;
      else byEmail.set(author.email, {identity: author, commits: 1});
    }
    return [...byEmail.values()].sort((a, b) => b.commits - a.commits);
  });

  protected authorNames = computed(() => {
    const names = this.authors().map(a => a.identity.name);
    const others = names.length - MAX_NAMES;
    return names.slice(0, MAX_NAMES).join(', ') + (others > 0 ? ` +${others} other${others > 1 ? 's' : ''}` : '');
  });

  protected MAX_AVATARS = MAX_AVATARS;

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