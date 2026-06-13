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

import {ChangeDetectionStrategy, Component, effect, inject, viewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ToastModule} from 'primeng/toast';
import {ConfirmDialog} from 'primeng/confirmdialog';
import {ContextMenu} from 'primeng/contextmenu';
import {Dialog} from 'primeng/dialog';
import {Button} from 'primeng/button';
import {GitApiService} from './services/electron-cmd-parser-layer/git-api.service';
import {SettingsService} from './services/settings.service';
import {GitRepositoryStore} from './stores/git-repos.store';
import {AutoFetchService} from './services/auto-fetch.service';
import {Router, RouterOutlet} from '@angular/router';
import {SettingsDialogComponent} from './components/dialogs/settings-dialog/settings-dialog.component';
import {ThemeService} from './services/theme.service'; // bootstraps theme reactivity
import {ActiveContextMenuService} from './services/active-context-menu.service';
import {FixupService} from './services/fixup.service';
import {MessageService} from 'primeng/api';

@Component({
  standalone: true,
  imports: [CommonModule, ToastModule, ConfirmDialog, RouterOutlet, SettingsDialogComponent, ContextMenu, Dialog, Button],
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {

  protected activeContextMenu = inject(ActiveContextMenuService);
  protected fixup = inject(FixupService);
  protected gitApi = inject(GitApiService);
  protected installInfo = this.getInstallInfo();
  private messageService = inject(MessageService);
  private settings = inject(SettingsService);
  private gitRepositoryStore = inject(GitRepositoryStore);
  private router = inject(Router);

  private globalMenu = viewChild.required<ContextMenu>('globalMenu');

  protected dismissToastOnClick = (event: Event) => {
    if ((event.target as Element).closest('.p-toast-message')) this.messageService.clear();
  };

  constructor() {
    inject(AutoFetchService); // Starts auto-fetch
    inject(ThemeService);     // Applies theme from config

    effect(() => this.activeContextMenu.register(this.globalMenu()));
    effect(() => this.router.navigate([this.gitRepositoryStore.hasRepositories() ? 'repo' : 'welcome-screen']));

    console.log('Process env: ', window.tauri.process.env);
  }

  private getInstallInfo() {
    const p = window.tauri.process.platform;
    return {
      cmd: p === 'win32'  ? 'winget install Git.Git' :
           p === 'darwin' ? 'brew install git' :
                            'sudo apt install git  /  sudo dnf install git',
      url: p === 'win32'  ? 'https://git-scm.com/download/win' :
           p === 'darwin' ? 'https://git-scm.com/download/mac' :
                            'https://git-scm.com/download/linux',
    };
  }

  protected openDownloadPage = () => window.tauri.openExternal(this.installInfo.url);

  protected browseForGit = () => {
    window.tauri.dialog.showOpenDialog({
      title: 'Select git executable',
      filters: window.tauri.process.platform === 'win32' ? [{name: 'Executable', extensions: ['exe']}] : [],
      properties: ['openFile'],
    }).then(paths => {
      if (paths?.[0]) {
        this.settings.gitBin = paths[0];
        this.gitApi.recheckGit();
      }
    });
  };
}
