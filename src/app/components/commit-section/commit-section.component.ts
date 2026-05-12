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
import {ReactiveFormsModule} from '@angular/forms';
import {CommitInfosComponent} from './commit-infos/commit-infos.component';
import {MakeACommitComponent} from './make-a-commit/make-a-commit.component';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {CommitsFileListInfoComponent} from './commits-file-list-info/commits-file-list-info.component';


@Component({
  selector: 'gitgud-commit-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommitInfosComponent,
    MakeACommitComponent,
    CommitsFileListInfoComponent,
  ],
  templateUrl: './commit-section.component.html',
  styleUrl: './commit-section.component.scss',
  host: {
    class: 'fill-height',
  },
})
export class CommitSectionComponent {

  protected currentRepo = inject(CurrentRepoStore);

}
