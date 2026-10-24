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

import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {Tooltip} from 'primeng/tooltip';
import {worktreeName} from '../../utils/worktree-utils';

/** The linked worktree a repository works in (toolbar), outlined to stand apart from the branch badge */
@Component({
  selector: 'gitgud-worktree-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Tooltip],
  template: `
    <span class="worktree-badge" [pTooltip]="tooltip()" tooltipPosition="bottom">
      <i class="fa fa-tree"></i>{{ name() }}
    </span>
  `,
  styles: `
    .worktree-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      padding: 0 6px;
      border-radius: 10px;
      border: 1px solid var(--p-primary-color);
      color: var(--p-primary-color);
      white-space: nowrap;
    }
  `,
  host: {style: 'flex-shrink: 0'},
})
export class WorktreeBadgeComponent {

  repoId = input.required<string>();
  path = input.required<string>();

  protected name = computed(() => worktreeName(this.path()));
  protected tooltip = computed(() =>
    `Working in the linked worktree ${this.path()} of ${this.repoId()}. Double-click a worktree, or check out its branch, to switch`);
}
