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

import {Component, effect, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ToastModule} from 'primeng/toast';
import {ConfirmDialog} from 'primeng/confirmdialog';
import {GitRepositoryStore} from './stores/git-repos.store';
import {AutoFetchService} from './services/auto-fetch.service';
import {Router, RouterOutlet} from '@angular/router';
import {SettingsDialogComponent} from './components/dialogs/settings-dialog/settings-dialog.component';
import {ThemeService} from './services/theme.service'; // bootstraps theme reactivity

@Component({
  standalone: true,
  imports: [CommonModule, ToastModule, ConfirmDialog, RouterOutlet, SettingsDialogComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {

  private readonly gitRepositoryStore = inject(GitRepositoryStore);
  private readonly router = inject(Router);

  constructor() {
    inject(AutoFetchService); // Starts auto-fetch
    inject(ThemeService);    // Applies theme from config


    effect(() => this.router.navigate([this.gitRepositoryStore.hasRepositories() ? 'repo' : 'welcome-screen']));

    console.log('Process env: ', window.electron.process.env);
  }
}
