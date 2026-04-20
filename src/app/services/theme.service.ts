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

import {effect, inject, Injectable} from '@angular/core';
import {GitRepositoryStore, ThemeMode} from '../stores/git-repos.store';

export type {ThemeMode};

@Injectable({providedIn: 'root'})
export class ThemeService {

  private readonly store = inject(GitRepositoryStore);
  private readonly systemDarkMq = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    effect(() => this.applyTheme(this.store.config().theme ?? 'system'));

    this.systemDarkMq.addEventListener('change', () => {
      if ((this.store.config().theme ?? 'system') === 'system') this.applyTheme('system');
    });
  }

  private applyTheme(mode: ThemeMode) {
    const isDark = mode === 'dark' || (mode === 'system' && this.systemDarkMq.matches);
    document.body.classList.toggle('theme-light', !isDark);
    document.body.classList.toggle('theme-dark', isDark);
  }
}
