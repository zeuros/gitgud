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

import {Component, Input, input, model, viewChild} from '@angular/core';
import {DATE_FORMAT} from '../../../utils/constants';
import {CommittedFileChange} from '../../../lib/github-desktop/model/status';
import {Commit} from '../../../lib/github-desktop/model/commit';
import {Tooltip} from 'primeng/tooltip';
import {AvatarComponent} from '../commit-infos/avatar/avatar.component';
import {Button} from 'primeng/button';
import {DatePipe} from '@angular/common';

@Component({
  selector: 'gitgud-commit-card',
  imports: [
    Tooltip,
    AvatarComponent,
    Button,
    DatePipe,
  ],
  templateUrl: './commit-card.component.html',
  styleUrl: './commit-card.component.scss',
  standalone: true,
})
export class CommitCardComponent {
  private shaTooltip = viewChild(Tooltip);

  commit = input<Commit | undefined>(undefined);
  showSha = input(true);
  showParent = input(false);

  protected copyTooltip = 'Copy';

  protected copyToClipboard = (sha: string) => {
    navigator.clipboard.writeText(sha);
    this.copyTooltip = 'Copied';
    setTimeout(() => this.shaTooltip()?.show(), 0);
  };

  protected DATE_FORMAT = DATE_FORMAT;
}
