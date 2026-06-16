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

import {effect, inject, Injectable, signal} from '@angular/core';
import {SettingsService} from './settings.service';
import {DARK_TOKENS, LIGHT_TOKENS, THEME_TOKENS, ThemeMode} from '../models/theme.model';

const DARK_CLASSES: ReadonlyArray<ThemeMode> = ['dark', 'forest', 'submarine', 'darcula', 'one-rainbow'];

@Injectable({providedIn: 'root'})
export class ThemeService {

  isDark = signal(true);
  tokens = signal(DARK_TOKENS);

  private settings = inject(SettingsService);

  constructor() {
    effect(() => this.applyTheme(this.settings.theme));
  }

  private applyTheme(mode: ThemeMode) {
    const html = document.querySelector('html')!;

    DARK_CLASSES.forEach(c => html.classList.remove(c));
    if (mode !== 'light') {
      html.classList.add('dark');
      if (mode !== 'dark') html.classList.add(mode);
    }

    const isDark = mode !== 'light';
    this.isDark.set(isDark);
    this.tokens.set(THEME_TOKENS[mode] ?? (isDark ? DARK_TOKENS : LIGHT_TOKENS));
  }
}
