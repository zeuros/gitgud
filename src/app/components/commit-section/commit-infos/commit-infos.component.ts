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

import {Component, effect, inject, signal, viewChild} from '@angular/core';
import {FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {InputText} from 'primeng/inputtext';
import {Textarea} from 'primeng/textarea';
import {Button} from 'primeng/button';
import {isEqual} from 'lodash-es';
import {directory, fileName} from '../../../utils/utils';
import {Tooltip} from 'primeng/tooltip';
import {ChangeSet} from '../../../lib/github-desktop/model/change-set';
import {CurrentRepoStore} from '../../../stores/current-repo.store';
import {GitWorkflowService} from '../../../services/git-workflow.service';
import {PopupService} from '../../../services/popup.service';
import {FileDiffService} from '../../../services/file-diff.service';
import {CommitCardComponent} from '../commit-line/commit-card.component';
import {Divider} from 'primeng/divider';
import {CommitFileListComponent} from '../commit-file-list/commit-file-list';

@Component({
  selector: 'gitgud-commit-infos',
  imports: [
    ReactiveFormsModule,
    InputText,
    Textarea,
    Tooltip,
    FormsModule,
    Button,
    CommitCardComponent,
    Divider,
    CommitFileListComponent,
  ],
  templateUrl: './commit-infos.component.html',
  styleUrl: './commit-infos.component.scss',
  standalone: true,
  host: {
    class: 'fill-height',
  },
})
export class CommitInfosComponent {

  protected editCommitForm = new FormGroup({
    summary: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
    description: new FormControl('', {nonNullable: true}),
  });
  private shaTooltip = viewChild(Tooltip);
  protected editedFiles = signal<ChangeSet | undefined>(undefined);
  protected initialValue: typeof this.editCommitForm.value = {};
  protected isEqual = isEqual;
  protected directory = directory;
  protected fileName = fileName;
  protected currentRepo = inject(CurrentRepoStore);
  private fileDiff = inject(FileDiffService);
  private gitWorkflow = inject(GitWorkflowService);
  private popup = inject(PopupService);

  constructor() {
    effect(() => {
      const selectedCommit = this.currentRepo.selectedCommit();

      if (selectedCommit) {
        this.fileDiff.getChangedFilesForGivenCommit(selectedCommit.sha).subscribe(editedFiles => this.editedFiles.set(editedFiles));
        this.editCommitForm.setValue({
          summary: selectedCommit.summary,
          description: selectedCommit.body,
        });
        this.initialValue = this.editCommitForm.value;
      }
    });
  }

  protected copyTooltip = 'Copy';
  protected copyToClipboard = (sha: string) => {
    navigator.clipboard.writeText(sha);
    this.copyTooltip = 'Copied';
    setTimeout(() => this.shaTooltip()?.show(), 0); // show after deactivate runs (deactivate is triggered when pTooltip gets new value)
  };

  protected rewordCommit = () =>
    this.gitWorkflow.rewordCommit(this.editCommitForm.getRawValue())
      .subscribe(() => {
        this.initialValue = this.editCommitForm.value;
        this.popup.success('Commit message updated');
      });

}
