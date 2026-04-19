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
import {Button} from 'primeng/button';
import {Dialog} from 'primeng/dialog';
import {InputNumber} from 'primeng/inputnumber';
import {FormsModule} from '@angular/forms';
import {PrimeTemplate} from 'primeng/api';
import {GitRepositoryStore} from '../../stores/git-repos.store';

@Component({
  selector: 'gitgud-settings',
  standalone: true,
  imports: [Button, Dialog, InputNumber, FormsModule, PrimeTemplate],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {

  private readonly gitRepositoryStore = inject(GitRepositoryStore);

  protected readonly visible = signal(false);
  protected readonly autoFetchInterval = signal(0);
  protected readonly zoom = signal(1);

  open() {
    this.autoFetchInterval.set(this.gitRepositoryStore.config().autoFetchInterval / 1000);
    this.visible.set(true);
  }

  protected save() {
    this.gitRepositoryStore.updateAppConfig({autoFetchInterval: this.autoFetchInterval() * 1000});
    localStorage.setItem('zoom', String(this.zoom()));
    this.visible.set(false);
  }
}
