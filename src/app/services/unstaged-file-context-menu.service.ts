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

import {computed, inject, Injectable, signal} from '@angular/core';
import {MenuItem} from 'primeng/api';
import {WorkingDirectoryFileChange} from '../lib/github-desktop/model/workdir';
import {WorkingDirectoryService} from './electron-cmd-parser-layer/working-directory.service';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {PopupService} from './popup.service';
import {AppFileStatusKind} from '../lib/github-desktop/model/status';

@Injectable({providedIn: 'root'})
export class UnstagedFileContextMenuService {
  private workingDir = inject(WorkingDirectoryService);
  private gitApi = inject(GitApiService);
  private popup = inject(PopupService);

  readonly selectedFile = signal<WorkingDirectoryFileChange | undefined>(undefined);
  readonly staged = signal(false);

  readonly contextMenu = computed<MenuItem[]>(() => [
    this.staged()
      ? {label: 'Unstage', icon: 'fa fa-minus', command: this.unstage}
      : {label: 'Stage', icon: 'fa fa-plus', command: this.stage},
    {separator: true},
    ...(this.staged() ? [] : [{label: 'Discard changes', icon: 'fa fa-trash', styleClass: 'danger-menuitem', command: this.discard}]),
    {label: 'Copy file path', icon: 'fa fa-copy', command: this.copyPath},
    {label: 'Show in folder', icon: 'fa fa-folder-open', command: this.showInFolder},
  ]);

  private stage = () => this.workingDir.stageFile(this.selectedFile()!);

  private unstage = () => this.workingDir.unstageFile(this.selectedFile()!);

  private discard = () => {
    const file = this.selectedFile()!;
    const isUntracked = file.status.kind === AppFileStatusKind.Untracked;
    const args = isUntracked
      ? ['clean', '-f', '--', file.path]
      : ['checkout', '--', file.path];
    this.gitApi.git(args).subscribe(this.workingDir.doFetchWorkingDirChanges);
  };

  private copyPath = () => {
    const file = this.selectedFile()!;
    const fullPath = window.electron.path.resolve(this.gitApi.cwd()!, file.path);
    navigator.clipboard.writeText(fullPath);
    this.popup.success('Path copied');
  };

  private showInFolder = () => {
    const file = this.selectedFile()!;
    const fullPath = window.electron.path.resolve(this.gitApi.cwd()!, file.path);
    window.electron.showItemInFolder(fullPath);
  };
}
