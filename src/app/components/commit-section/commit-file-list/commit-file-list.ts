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
import {type AppFileStatusKind, type CommittedFileChange, FileStatusesIcons} from '../../../lib/github-desktop/model/status';
import {FileDiffPanelService} from '../../../services/file-diff-panel.service';
import {ThemeService} from '../../../services/theme.service';
import {CommittedFileContextMenuService} from '../../../services/committed-file-context-menu.service';

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
               (contextmenu)="openContextMenu($event)"
               class="fill-height">
      <ng-template #item let-f>
        @let file = file$(f);
        @let dir = directory(file.path);
        <span class="file-row" [title]="file.path">
          <i class="text-gray mr-2 fa {{ FileStatusesIcons[file.status.kind].icon }}"
             [style.color]="FileStatusesIcons[file.status.kind].color"
             [style.filter]="iconDropShadow(file.status.kind)"></i>
          @if (dir.length) {
            <span class="ellipsis text-gray" [style.min-width.rem]="1.3">{{ dir }}</span>
          }
          <span class="white-space-nowrap">{{ (dir?.length ? '/' : '') + fileName(file.path) }}</span>
        </span>
      </ng-template>
    </p-listbox>
  `,
  styles: `
    // Lays out its children as direct items of the option, only there to hold the tooltip
    .file-row {
      display: contents;
    }
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
  private theme = inject(ThemeService);
  private contextMenu = inject(CommittedFileContextMenuService);

  // Listened on the listbox rather than in the item template, so the row's padding opens the menu too
  protected openContextMenu(event: MouseEvent) {
    const option = (event.target as Element).closest('.p-listbox-option');
    if (!option) return;
    const index = Array.from(option.parentElement!.querySelectorAll(':scope > .p-listbox-option')).indexOf(option);
    const file = this.files()[index];
    if (file) this.contextMenu.open(file, event);
  }

  protected iconDropShadow(kind: AppFileStatusKind): string {
    const alpha = this.theme.isDark() ? '' : '80';
    return `drop-shadow(0 0 5px ${FileStatusesIcons[kind].color}${alpha})`;
  }

  protected file$ = (f: CommittedFileChange) => f;
}