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

import {Component, inject, signal} from '@angular/core';
import {Dialog} from 'primeng/dialog';
import {Button} from 'primeng/button';
import {PrimeTemplate} from 'primeng/api';
import {DatePipe} from '@angular/common';
import {GitCommandHistoryService} from '../../../services/git-command-history.service';

@Component({
  selector: 'gitgud-shell-history-dialog',
  standalone: true,
  imports: [Dialog, Button, PrimeTemplate, DatePipe],
  templateUrl: './shell-history-dialog.component.html',
  styleUrl: './shell-history-dialog.component.scss',
})
export class ShellHistoryDialogComponent {

  protected history = inject(GitCommandHistoryService);
  protected visible = signal(false);

  open() {
    this.visible.set(true);
  }
}
