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
import {type MenuItem} from 'primeng/api';
import {WorkingDirectoryFileChange} from '../lib/github-desktop/model/workdir';
import {WorkingDirectoryService} from './electron-cmd-parser-layer/working-directory.service';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {GitRefreshService} from './git-refresh.service';
import {PopupService} from './popup.service';
import {AppFileStatusKind} from '../lib/github-desktop/model/status';
import {FileDiffPanelService} from './file-diff-panel.service';
import {CurrentRepoStore} from '../stores/current-repo.store';

@Injectable({providedIn: 'root'})
export class UnstagedFileContextMenuService {
  private workingDir = inject(WorkingDirectoryService);
  private gitApi = inject(GitApiService);
  private gitRefresh = inject(GitRefreshService);
  private currentRepo = inject(CurrentRepoStore);
  private popup = inject(PopupService);
  private fileDiffPanel = inject(FileDiffPanelService);

  selectedFiles = signal<WorkingDirectoryFileChange[]>([]);
  staged = signal(false);

  contextMenu = computed<MenuItem[]>(() => {
    const files = this.selectedFiles();
    const count = files.length;
    const multi = count > 1;
    const label = (single: string) => multi ? `${single} ${count} files` : single;

    return [
      this.staged()
        ? {label: label('Unstage'), icon: 'fa fa-minus', command: this.unstage}
        : {label: label('Stage'), icon: 'fa fa-plus', command: this.stage},
      {separator: true},
      ...(this.staged() ? [] : [{label: label('Discard changes'), icon: 'fa fa-trash', styleClass: 'danger-menuitem', command: this.discard}]),
      ...(!multi ? [
        {label: 'Copy file path', icon: 'fa fa-copy', command: this.copyPath},
        {label: 'Show in folder', icon: 'fa fa-folder-open', command: this.showInFolder},
      ] : []),
    ];
  });

  private stage = () => this.workingDir.stageFiles(this.selectedFiles());

  private unstage = () => this.workingDir.unstageFiles(this.selectedFiles());

  private discard = () => {
    const files = this.selectedFiles();
    const displayedPath = this.fileDiffPanel.selectedFile()?.path;

    if (files.some(f => f.path === displayedPath))
      this.fileDiffPanel.closeDiffView();

    const tracked = files.filter(f => f.status.kind !== AppFileStatusKind.Untracked);
    const untracked = files.filter(f => f.status.kind === AppFileStatusKind.Untracked);
    if (tracked.length) this.gitApi.gitAction(['checkout', '--', ...tracked.map(f => f.path)]).subscribe(this.gitRefresh.doUpdateWorkingDirChanges);
    if (untracked.length) this.gitApi.gitAction(['clean', '-f', '--', ...untracked.map(f => f.path)]).subscribe(this.gitRefresh.doUpdateWorkingDirChanges);
  };

  private copyPath = () => {
    const file = this.selectedFiles()[0];
    const fullPath = window.electron.path.resolve(this.currentRepo.cwd()!, file.path);
    navigator.clipboard.writeText(fullPath);
    this.popup.success('Path copied');
  };

  private showInFolder = () => {
    const file = this.selectedFiles()[0];
    const fullPath = window.electron.path.resolve(this.currentRepo.cwd()!, file.path);
    window.electron.showItemInFolder(fullPath);
  };
}
