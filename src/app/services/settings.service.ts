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

import {Injectable, signal} from '@angular/core';
import {DEFAULT_AUTO_FETCH_INTERVAL} from '../utils/constants';
import { THEMES, type ThemeMode } from "../models/theme.model";
import {DEFAULT_EDITOR_COMMAND} from '../utils/editor-command.utils';

@Injectable({providedIn: 'root'})
export class SettingsService {

  private _zoom = signal(window.tauri.zoom.getFactor());
  readonly autoFetchIntervalMs = signal(parseFloat(localStorage.getItem('auto-fetch-interval') ?? DEFAULT_AUTO_FETCH_INTERVAL));
  // A stored theme that no longer exists falls back to the system's color scheme
  private _theme = signal<ThemeMode>(
    THEMES.find(t => t.id === localStorage.getItem('theme'))?.id ??
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );
  readonly themeSignal = this._theme.asReadonly();
  // The Flatpak runs the git it bundles: a binary picked on the host reaches the sandbox alone, without the helpers git
  // runs (git-remote-https…)
  readonly bundlesGit = window.tauri.packageFormat === 'Flatpak';
  private _gitBin = signal(this.bundlesGit ? 'git' : localStorage.getItem('git-binary-path') ?? 'git');
  private _editorCommand = signal(localStorage.getItem('editor-command') ?? DEFAULT_EDITOR_COMMAND);
  // Commit message styles the worktree agents are told to follow
  readonly agentUsesGitmoji = signal(localStorage.getItem('agent-uses-gitmoji') === 'true');
  readonly agentUsesConventionalCommits = signal(localStorage.getItem('agent-uses-conventional-commits') === 'true');

  get zoom() { return this._zoom(); }
  get autoFetchIntervalSeconds() { return this.autoFetchIntervalMs() / 1000; }
  get theme() { return this._theme(); }
  get gitBin() { return this._gitBin(); }
  get editorCommand() { return this._editorCommand(); }

  set zoom(factor: number) {
    this._zoom.set(factor);
    window.tauri.zoom.setFactor(factor);
  }

  set autoFetchIntervalSeconds(v: number) {
    this.autoFetchIntervalMs.set(v * 1000);
    localStorage.setItem('auto-fetch-interval', String(v * 1000));
  }

  set theme(v: ThemeMode) {
    this._theme.set(v);
    localStorage.setItem('theme', v);
  }

  set gitBin(v: string) {
    this._gitBin.set(v);
    localStorage.setItem('git-binary-path', v);
  }

  set editorCommand(v: string) {
    this._editorCommand.set(v);
    localStorage.setItem('editor-command', v);
  }

  setAgentUsesGitmoji(usesGitmoji: boolean) {
    this.agentUsesGitmoji.set(usesGitmoji);
    localStorage.setItem('agent-uses-gitmoji', String(usesGitmoji));
  }

  setAgentUsesConventionalCommits(usesConventionalCommits: boolean) {
    this.agentUsesConventionalCommits.set(usesConventionalCommits);
    localStorage.setItem('agent-uses-conventional-commits', String(usesConventionalCommits));
  }

}
