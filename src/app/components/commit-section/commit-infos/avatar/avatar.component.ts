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

import {Component, input} from '@angular/core';
import {CommitIdentity} from '../../../../lib/github-desktop/model/commit-identity';
import {GravatarUrlPipe} from '../../../../pipes/gravatar-url';
import {IdenticonPipe} from '../../../../services/identicon-pipe.service';

@Component({
  selector: 'gitgud-avatar',
  imports: [
    GravatarUrlPipe,
    IdenticonPipe,
  ],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
  standalone: true,
})
export class AvatarComponent {

  identity = input<CommitIdentity | undefined>(undefined);
  protected avatarLoaded = false;

}
