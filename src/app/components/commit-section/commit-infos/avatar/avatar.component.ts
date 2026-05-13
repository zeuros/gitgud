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

import {Component, computed, inject, input} from '@angular/core';
import {CommitIdentity} from '../../../../lib/github-desktop/model/commit-identity';
import {IdenticonPipe} from '../../../../services/identicon-pipe.service';
import {AvatarCacheService} from './avatar-cache.service';
import {AsyncPipe} from '@angular/common';

@Component({
  selector: 'gitgud-avatar',
  imports: [IdenticonPipe, AsyncPipe],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
  standalone: true,
})
export class AvatarComponent {
  private avatarCache = inject(AvatarCacheService);

  identity = input.required<CommitIdentity>();

  protected objectUrl = computed(() => this.avatarCache.resolve(this.identity().email));
}
