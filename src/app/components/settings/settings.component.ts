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
import {InputNumber} from 'primeng/inputnumber';
import {FormsModule} from '@angular/forms';
import {SettingsService} from '../../services/settings.service';

@Component({
  selector: 'gitgud-settings',
  standalone: true,
  imports: [Dialog, InputNumber, FormsModule],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {

  readonly settingsService = inject(SettingsService);
  protected readonly visible = signal(false);

  open() {
    this.visible.set(true);
  }
}
