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

import {effect, Injectable, signal} from '@angular/core';
import {DEFAULT_AUTO_FETCH_INTERVAL} from '../utils/constants';

export type ThemeMode = 'dark' | 'light' | 'system';

@Injectable({providedIn: 'root'})
export class SettingsService {

  private _zoom = signal(parseFloat(localStorage.getItem('zoom') ?? '1'));
  private _autoFetchInterval = signal(parseFloat(localStorage.getItem('auto-fetch-interval') ?? DEFAULT_AUTO_FETCH_INTERVAL));
  private _theme = signal<ThemeMode>((localStorage.getItem('theme') as ThemeMode) ?? 'system');
  private _gitBin = signal(localStorage.getItem('git-binary-path') ?? 'git');

  get zoom() { return this._zoom(); }
  get autoFetchInterval() { return this._autoFetchInterval(); }
  get autoFetchIntervalSeconds() { return this._autoFetchInterval() / 1000; }
  get theme() { return this._theme(); }
  get gitBin() { return this._gitBin(); }

  constructor() {
    window.electron.zoom?.setFactor(this._zoom());
  }

  set zoom(factor: number) {
    this._zoom.set(factor);
    window.electron.zoom?.setFactor(factor);
    localStorage.setItem('zoom', String(factor));
  }

  set autoFetchInterval(v: number) {
    this._autoFetchInterval.set(v);
    localStorage.setItem('auto-fetch-interval', String(v));
  }

  set autoFetchIntervalSeconds(v: number) { this.autoFetchInterval = v * 1000; }

  set theme(v: ThemeMode) {
    this._theme.set(v);
    localStorage.setItem('theme', v);
  }

  set gitBin(v: string) {
    this._gitBin.set(v);
    localStorage.setItem('git-binary-path', v);
  }

}
