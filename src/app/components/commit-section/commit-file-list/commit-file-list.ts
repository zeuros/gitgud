// commit-file-list.component.ts
import {Component, inject, input} from '@angular/core';
import {directory, fileName} from '../../../utils/utils';
import {Listbox, ListboxChangeEvent} from 'primeng/listbox';
import {CommittedFileChange, FileStatusesIcons} from '../../../lib/github-desktop/model/status';
import {FileDiffPanelService} from '../../../services/file-diff-panel.service';

@Component({
  selector: 'gitgud-commit-file-list',
  standalone: true,
  imports: [Listbox],
  template: `
    <p-listbox animate.enter="fade-slide-in-out-enter"
               [options]="files().slice()"
               (onChange)="onFileChange($event)"
               scrollHeight="auto"
               optionLabel="path">
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
})
export class CommitFileListComponent {
  files = input.required<CommittedFileChange[]>();

  protected directory = directory;
  protected fileName = fileName;
  protected FileStatusesIcons = FileStatusesIcons;
  private fileDiffPanelService = inject(FileDiffPanelService);

  protected onFileChange(event: ListboxChangeEvent) {
    this.fileDiffPanelService.showCommittedFileDiffs(event.value);
  }
  protected file$ = (f: CommittedFileChange) => f;
}