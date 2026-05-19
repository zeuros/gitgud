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

import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {Divider} from 'primeng/divider';
import {FormBuilder, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {Textarea} from 'primeng/textarea';
import {Button} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {WorkingDirectoryService} from '../../../services/electron-cmd-parser-layer/working-directory.service';
import {TableModule} from 'primeng/table';
import {FileStatusesIcons} from '../../../lib/github-desktop/model/status';
import {directory, fileName} from '../../../utils/utils';
import {FileDiffPanelService} from '../../../services/file-diff-panel.service';
import {PrimeTemplate} from 'primeng/api';
import {CurrentRepoStore} from '../../../stores/current-repo.store';
import {CommitService} from '../../../services/commit.service';
import {FixupService} from '../../../services/fixup.service';
import {Checkbox} from 'primeng/checkbox';
import {headCommit} from '../../../utils/commit-utils';
import {type WorkDirStatus, WorkingDirectoryFileChange} from '../../../lib/github-desktop/model/workdir';
import {Splitter} from 'primeng/splitter';
import {WorkingDirFileSelectionService} from '../../../services/working-dir-file-selection.service';

@Component({
  selector: 'gitgud-make-a-commit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Divider,
    ReactiveFormsModule,
    Textarea,
    InputText,
    TableModule,
    Button,
    PrimeTemplate,
    Checkbox,
    Splitter,
    FormsModule,
  ],
  templateUrl: './make-a-commit.component.html',
  styleUrl: './make-a-commit.component.scss',
  standalone: true,
})
export class MakeACommitComponent {

  protected fileDiffPanel = inject(FileDiffPanelService);
  protected workingDirectory = inject(WorkingDirectoryService);
  protected currentRepo = inject(CurrentRepoStore);
  protected workingDirSelection = inject(WorkingDirFileSelectionService);
  protected commitForm = inject(FormBuilder).nonNullable.group({summary: '', description: ''});
  protected amend = signal(false);
  protected FileStatusesIcons = FileStatusesIcons;
  protected keys = Object.keys;
  protected directory = directory;
  protected fileName = fileName;
  private commitService = inject(CommitService);
  protected fixup = inject(FixupService);
  private savedFormState?: typeof this.commitForm.value;

  protected commit() {
    const {summary, description} = this.commitForm.value;
    this.commitService.commit(summary!, description?.length ? description : undefined, this.amend());
  }

  protected toggleAmendMode(amend: boolean) {
    if (amend) {
      // Save current form state
      this.savedFormState = this.commitForm.value;

      // Prefill with last commit message
      const lastCommit = headCommit(this.currentRepo.branches(), this.currentRepo.logs());
      if (lastCommit) this.commitForm.patchValue({summary: lastCommit.summary, description: lastCommit.body ?? ''});
    } else {
      // Restore saved state
      if (this.savedFormState) {
        this.commitForm.patchValue(this.savedFormState);
        this.savedFormState = undefined;
      }
    }
  }

  protected commitReady = (workDirStatus?: WorkDirStatus) =>
    !!(this.commitForm.value.summary?.length && workDirStatus?.staged?.length && !workDirStatus.conflicted.length);

  protected $WorkDirFileChanges = (w: WorkingDirectoryFileChange) => w;
}
