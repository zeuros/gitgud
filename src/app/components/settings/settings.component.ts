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

import {Component, computed, inject, signal} from '@angular/core';
import {Button} from 'primeng/button';
import {Dialog} from 'primeng/dialog';
import {InputNumber} from 'primeng/inputnumber';
import {InputText} from 'primeng/inputtext';
import {Select} from 'primeng/select';
import {FormsModule} from '@angular/forms';
import {PrimeTemplate} from 'primeng/api';
import {GitRepositoryStore, ThemeMode} from '../../stores/git-repos.store';
import {GitApiService} from '../../services/electron-cmd-parser-layer/git-api.service';
import {PopupService} from '../../services/popup.service';
import {forkJoin} from 'rxjs';

@Component({
  selector: 'gitgud-settings',
  standalone: true,
  imports: [Button, Dialog, InputNumber, InputText, Select, FormsModule, PrimeTemplate],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {

  private readonly gitRepositoryStore = inject(GitRepositoryStore);
  private readonly gitApi = inject(GitApiService);
  private readonly popup = inject(PopupService);

  protected readonly visible = signal(false);
  protected readonly autoFetchInterval = signal(0);
  protected readonly theme = signal<ThemeMode>('system');
  protected readonly gitBinaryPath = signal('');
  protected readonly globalUserName = signal('');
  protected readonly globalUserEmail = signal('');
  protected readonly localUserName = signal('');
  protected readonly localUserEmail = signal('');
  protected readonly hasRepo = computed(() => !!this.gitApi.cwd());

  protected readonly themeOptions = [
    {label: 'System', value: 'system'},
    {label: 'Dark', value: 'dark'},
    {label: 'Light', value: 'light'},
  ];

  open() {
    const config = this.gitRepositoryStore.config();
    this.autoFetchInterval.set(config.autoFetchInterval / 1000);
    this.theme.set(config.theme ?? 'system');
    this.gitBinaryPath.set(config.gitBinaryPath ?? '');

    forkJoin({
      globalName: this.gitApi.git(['config', '--global', 'user.name']),
      globalEmail: this.gitApi.git(['config', '--global', 'user.email']),
      ...(this.hasRepo() ? {
        localName: this.gitApi.git(['config', '--local', 'user.name']),
        localEmail: this.gitApi.git(['config', '--local', 'user.email']),
      } : {}),
    }).subscribe({
      next: (r: any) => {
        this.globalUserName.set((r.globalName ?? '').trim());
        this.globalUserEmail.set((r.globalEmail ?? '').trim());
        this.localUserName.set((r.localName ?? '').trim());
        this.localUserEmail.set((r.localEmail ?? '').trim());
      },
      error: () => {},
    });

    this.visible.set(true);
  }

  protected pickGitBinary() {
    const picked = window.electron.dialog.showOpenDialogSync({
      properties: ['openFile'],
      filters: [{name: 'Executables', extensions: ['*']}],
    });
    if (picked?.[0]) this.gitBinaryPath.set(picked[0]);
  }

  protected save() {
    this.gitRepositoryStore.updateAppConfig({
      autoFetchInterval: this.autoFetchInterval() * 1000,
      theme: this.theme(),
      gitBinaryPath: this.gitBinaryPath() || undefined,
    });

    const globalName = this.globalUserName().trim();
    const globalEmail = this.globalUserEmail().trim();
    const localName = this.localUserName().trim();
    const localEmail = this.localUserEmail().trim();

    if (globalName) this.gitApi.git(['config', '--global', 'user.name', globalName]).subscribe();
    if (globalEmail) this.gitApi.git(['config', '--global', 'user.email', globalEmail]).subscribe();
    if (this.hasRepo() && localName) this.gitApi.git(['config', '--local', 'user.name', localName]).subscribe();
    if (this.hasRepo() && localEmail) this.gitApi.git(['config', '--local', 'user.email', localEmail]).subscribe();
    this.visible.set(false);
    this.popup.success('Settings saved');
  }
}
