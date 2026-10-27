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

import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Tooltip} from 'primeng/tooltip';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {GitRefreshService} from '../../services/git-refresh.service';

/** The bonfire logo and the current repository's name, at the start of the tab strip */
@Component({
  selector: 'gitgud-repo-title',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Tooltip],
  templateUrl: './repo-title.component.html',
  styleUrl: './repo-title.component.scss',
})
export class RepoTitleComponent {
  protected currentRepo = inject(CurrentRepoStore);
  private gitRefresh = inject(GitRefreshService);
  protected bonfireHovered = signal(false);
  protected appVersion = window.tauri.appVersion + (window.tauri.buildCommit ? ` (${window.tauri.buildCommit})` : '');
  protected bonfirePlaying = computed(() => this.bonfireHovered() || this.gitRefresh.isRefreshing());
}
