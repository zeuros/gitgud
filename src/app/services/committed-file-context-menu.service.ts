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

import {inject, Injectable, type WritableSignal} from '@angular/core';
import {ConfirmationService, type MenuItem} from 'primeng/api';
import {AppFileStatusKind, type CommittedFileChange} from '../lib/github-desktop/model/status';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {ToastService} from './toast.service';
import {ActiveContextMenuService} from './active-context-menu.service';
import {FileDiffPanelService} from './file-diff-panel.service';
import {GitWorkflowService} from './git-workflow.service';
import {SettingsService} from './settings.service';
import {fileName} from '../utils/utils';
import {short} from '../utils/commit-utils';

@Injectable({providedIn: 'root'})
export class CommittedFileContextMenuService {
  private currentRepo = inject(CurrentRepoStore);
  private toast = inject(ToastService);
  private activeContextMenu = inject(ActiveContextMenuService);
  private fileDiffPanel = inject(FileDiffPanelService);
  private gitWorkflow = inject(GitWorkflowService);
  private confirmation = inject(ConfirmationService);
  private settings = inject(SettingsService);

  open = (file: CommittedFileChange, event: MouseEvent) => {
    event.preventDefault();
    this.activeContextMenu.show(this.contextMenu(file), event);
  };

  private contextMenu = (file: CommittedFileChange): MenuItem[] => {
    // A file the commit deleted has no content at that commit
    const existsAtCommit = file.status.kind !== AppFileStatusKind.Deleted;

    return [
      {label: 'File history', icon: 'fa fa-history', command: () => this.openTool(file, this.fileDiffPanel.historyOpen)},
      {label: 'Blame', icon: 'fa fa-user', command: () => this.openTool(file, this.fileDiffPanel.blameOpen)},
      {separator: true},
      ...(existsAtCommit ? [
        {label: 'Open file at this commit', icon: 'fa fa-external-link', command: () => this.openAtCommit(file)},
        {label: 'Restore file from this commit', icon: 'fa fa-undo', command: () => this.restore(file)},
        {separator: true},
      ] : []),
      {label: 'Copy file path', icon: 'fa fa-copy', command: () => this.copy(this.fullPath(file))},
      {label: 'Copy relative path', icon: 'fa fa-copy', command: () => this.copy(file.path)},
      {label: 'Show in folder', icon: 'fa fa-folder-open', command: () => this.showInFolder(file)},
    ];
  };

  private fullPath = (file: CommittedFileChange) => window.tauri.path.resolve(this.currentRepo.cwd()!, file.path);

  private openTool = (file: CommittedFileChange, tool: WritableSignal<boolean>) => {
    this.fileDiffPanel.showCommittedFileDiffs(file);
    tool.set(true);
  };

  // Extracts the file's revision into the temp dir and hands it to the system's default application
  private openAtCommit = async (file: CommittedFileChange) => {
    const target = window.tauri.path.resolve(await window.tauri.tempDir(), 'gitgud', short(file.commitish), file.path);
    const {status, stderr} = await window.tauri.spawnSync(
      'bash',
      ['-c', 'mkdir -p "$(dirname "$3")" && "$1" show "$2" > "$3"', 'bash', this.settings.gitBin, `${file.commitish}:${file.path}`, target],
      {cwd: this.currentRepo.cwd()},
    );
    if (status !== 0) return this.toast.err(stderr);

    window.tauri.openPath(target).catch(this.toast.err);
  };

  private restore = (file: CommittedFileChange) =>
    this.confirmation.confirm({
      header: `Restore ${fileName(file.path)} ?`,
      message: `The file is overwritten with its content at ${short(file.commitish)} and staged. Uncommitted changes to it will be lost.`,
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: 'Restore',
      rejectLabel: 'Cancel',
      accept: () => this.gitWorkflow.doRunAndRefresh(['checkout', file.commitish, '--', file.path], `Restored ${fileName(file.path)} from ${short(file.commitish)}`),
    });

  private copy = (path: string) => {
    navigator.clipboard.writeText(path);
    this.toast.success('Path copied');
  };

  private showInFolder = async (file: CommittedFileChange) => {
    const fullPath = this.fullPath(file);
    if (!await window.tauri.fs.exists(fullPath)) return this.toast.warn(`${fileName(file.path)} no longer exists in the working directory`);

    window.tauri.showItemInFolder(fullPath);
  };
}
