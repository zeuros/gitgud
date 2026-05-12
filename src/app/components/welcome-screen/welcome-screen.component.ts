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

import {Component, inject, viewChild} from '@angular/core';
import {GitRepositoryService} from '../../services/git-repository.service';
import {ButtonModule} from 'primeng/button';
import {DialogModule} from 'primeng/dialog';
import {CloneDialogComponent} from '../dialogs/clone-dialog/clone-dialog.component';

@Component({
  selector: 'gitgud-welcome-screen',
  standalone: true,
  imports: [ButtonModule, DialogModule, CloneDialogComponent],
  templateUrl: './welcome-screen.component.html',
  styleUrl: './welcome-screen.component.scss',
})
export class WelcomeScreenComponent {

  protected gitRepository = inject(GitRepositoryService);
  private cloneDialog = viewChild.required(CloneDialogComponent);

  protected openCloneDialog = () => this.cloneDialog().open();

}
