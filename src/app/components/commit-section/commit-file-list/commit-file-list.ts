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

import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {directory, fileName} from '../../../utils/utils';
import {FormsModule} from '@angular/forms';
import {Listbox} from 'primeng/listbox';
import {CommittedFileChange, FileStatusesIcons} from '../../../lib/github-desktop/model/status';
import {FileDiffPanelService} from '../../../services/file-diff-panel.service';

@Component({
  selector: 'gitgud-commit-file-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Listbox, FormsModule],
  template: `
    <p-listbox animate.enter="fade-slide-in-out-enter"
               [options]="files().slice()"
               [ngModel]="fileDiffPanel.selectedFile()"
               (ngModelChange)="fileDiffPanel.showCommittedFileDiffs($event)"
               scrollHeight="auto"
               optionLabel="path"
               class="fill-height">
      <ng-template #item let-f>
        @let file = file$(f);
        @let dir = directory(file.path);
        <i class="text-gray mr-2 fa {{ FileStatusesIcons[file.status.kind].icon }}"
           [style.color]="FileStatusesIcons[file.status.kind].color"
           [style.filter]="'drop-shadow(0 0 5px ' + FileStatusesIcons[file.status.kind].color + '88)'"></i>
        @if (dir.length) {
          <span class="ellipsis text-gray" [style.min-width.rem]="1.3">{{ dir }}</span>
        }
        <span class="white-space-nowrap">{{ (dir?.length ? '/' : '') + fileName(file.path) }}</span>
      </ng-template>
    </p-listbox>
  `,
  host: {
    class: 'overflow-hidden',
  },
})
export class CommitFileListComponent {
  files = input.required<CommittedFileChange[]>();

  protected directory = directory;
  protected fileName = fileName;
  protected FileStatusesIcons = FileStatusesIcons;
  protected fileDiffPanel = inject(FileDiffPanelService);

  protected file$ = (f: CommittedFileChange) => f;
}