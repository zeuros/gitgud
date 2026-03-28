import {Component, effect, inject, viewChild} from '@angular/core';
import {WorkingDirectoryService} from '../../../services/electron-cmd-parser-layer/working-directory.service';
import {FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {InputText} from 'primeng/inputtext';
import {Textarea} from 'primeng/textarea';
import {Button} from 'primeng/button';
import {DatePipe} from '@angular/common';
import {isEqual} from 'lodash-es';
import {DATE_FORMAT} from '../../../utils/constants';
import {directory, fileName} from '../../../utils/utils';
import {Tooltip} from 'primeng/tooltip';
import {AvatarComponent} from './avatar/avatar.component';
import {Listbox} from 'primeng/listbox';
import {ChangeSet, CommittedFileChange} from '../../../lib/github-desktop/model/change-set';
import {FileStatusesIcons} from '../../../lib/github-desktop/model/status';
import {FileDiffPanelService} from '../../../services/file-diff-panel.service';
import {GitRepositoryStore} from '../../../stores/git-repos.store';

@Component({
  selector: 'gitgud-commit-infos',
  imports: [
    ReactiveFormsModule,
    InputText,
    Textarea,
    DatePipe,
    Tooltip,
    AvatarComponent,
    Listbox,
    FormsModule,
    Button,
  ],
  templateUrl: './commit-infos.component.html',
  styleUrl: './commit-infos.component.scss',
})
export class CommitInfosComponent {

  protected editCommitForm = new FormGroup({
    summary: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
    description: new FormControl('', {nonNullable: true}),
  });
  private shaTooltip = viewChild(Tooltip);
  protected initialValue: typeof this.editCommitForm.value = {};
  protected editedFiles?: ChangeSet;
  protected isEqual = isEqual;
  protected DATE_FORMAT = DATE_FORMAT;
  protected directory = directory;
  protected fileName = fileName;
  protected FileStatusesIcons = FileStatusesIcons;
  protected gitRepositoryStore = inject(GitRepositoryStore);
  private workingDirectoryService = inject(WorkingDirectoryService);
  protected fileDiffPanelService = inject(FileDiffPanelService);

  constructor() {
    effect(() => {
      const selectedCommit = this.gitRepositoryStore.selectedCommit();
      const selectedCommitsShas = this.gitRepositoryStore.selectedCommitsShas();

      if (selectedCommit) {
        this.workingDirectoryService.getChangedFilesForGivenCommit(selectedCommit.sha).subscribe(editedFiles => this.editedFiles = editedFiles);
        this.editCommitForm.setValue({
          summary: selectedCommit.summary,
          description: selectedCommit.body,
        });
        this.initialValue = this.editCommitForm.value;

      } else if (selectedCommitsShas && selectedCommitsShas?.length > 1)
        console.warn('TODO');
    });
  }

  protected copyTooltip = 'Copy';
  protected copyToClipboard = (sha: string) => {
    navigator.clipboard.writeText(sha);
    this.copyTooltip = 'Copied';
    setTimeout(() => this.shaTooltip()?.show(), 0); // show after deactivate runs (deactivate is triggered when pTooltip gets new value)
  };

  protected file$ = (f: CommittedFileChange) => f;
}
