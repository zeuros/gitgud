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

import {inject, Injectable, signal} from '@angular/core';
import {WorkingDirectoryFileChange} from '../lib/github-desktop/model/workdir';
import {FileDiffPanelService} from './file-diff-panel.service';
import {UnstagedFileContextMenuService} from './unstaged-file-context-menu.service';
import {ActiveContextMenuService} from './active-context-menu.service';

@Injectable({providedIn: 'root'})
export class WorkingDirFileSelectionService {

  private fileDiffPanel = inject(FileDiffPanelService);
  private unstagedContextMenu = inject(UnstagedFileContextMenuService);
  private activeContextMenu = inject(ActiveContextMenuService);

  selectedConflictFile = signal<WorkingDirectoryFileChange | null>(null);
  selectedUnstagedFiles = signal<WorkingDirectoryFileChange[]>([]);
  selectedStagedFiles = signal<WorkingDirectoryFileChange[]>([]);

  onConflictFileSelect = (file: WorkingDirectoryFileChange | null) => {
    this.selectedConflictFile.set(file);
    if (file) this.fileDiffPanel.showWorkingDirDiffs(file);
    else this.fileDiffPanel.closeViews();
  };

  onStagingFileSelectionChange = (files: WorkingDirectoryFileChange[], staged: boolean) => {
    const current = staged ? this.selectedStagedFiles() : this.selectedUnstagedFiles();

    const isReclick = files.length === 1 && current.length === 1 && current[0].path === files[0].path;
    if (isReclick) {
      (staged ? this.selectedStagedFiles : this.selectedUnstagedFiles).set([]);
      this.fileDiffPanel.closeViews();
      return;
    }
    (staged ? this.selectedStagedFiles : this.selectedUnstagedFiles).set(files);
    (staged ? this.selectedUnstagedFiles : this.selectedStagedFiles).set([]);

    if (files.length === 1) this.fileDiffPanel.showWorkingDirDiffs(files[0]);
    else this.fileDiffPanel.closeViews();
  };

  openFileContextMenu = (file: WorkingDirectoryFileChange, staged: boolean, event: MouseEvent) => {
    event.preventDefault();
    const currentSelection = staged ? this.selectedStagedFiles() : this.selectedUnstagedFiles();
    if (!currentSelection.some(f => f.path === file.path))
      (staged ? this.selectedStagedFiles : this.selectedUnstagedFiles).set([file]);
    this.unstagedContextMenu.selectedFiles.set(staged ? this.selectedStagedFiles() : this.selectedUnstagedFiles());
    this.unstagedContextMenu.staged.set(staged);
    this.activeContextMenu.show(this.unstagedContextMenu.contextMenu(), event);
  };
}
