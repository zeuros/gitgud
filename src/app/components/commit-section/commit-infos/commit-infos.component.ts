import {Component, effect, inject} from '@angular/core';
import {WorkingDirectoryService} from '../../../services/electron-cmd-parser-layer/working-directory.service';
import {FormControl, FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {InputText} from 'primeng/inputtext';
import {Textarea} from 'primeng/textarea';
import {ButtonDirective} from 'primeng/button';
import {DatePipe, NgIf} from '@angular/common';
import {isEqual} from 'lodash-es';
import {DATE_FORMAT} from '../../../utils/constants';
import {directory, fileName} from '../../../utils/utils';
import {Tooltip} from 'primeng/tooltip';
import {AvatarComponent} from './avatar/avatar.component';
import {Listbox} from 'primeng/listbox';
import {ChangeSet, CommittedFileChange} from '../../../lib/github-desktop/model/change-set';
import {FileStatusesIcons} from '../../../lib/github-desktop/model/status';
import {FileDiffPanelService} from '../../../services/file-diff-panel.service';
import {slightSlideIn} from '../../../shared/animations';
import {GitRepositoryStore} from '../../../stores/git-repos.store';

@Component({
  selector: 'gitgud-commit-infos',
  imports: [
    ReactiveFormsModule,
    InputText,
    Textarea,
    ButtonDirective,
    NgIf,
    DatePipe,
    Tooltip,
    AvatarComponent,
    Listbox,
    FormsModule,
  ],
  templateUrl: './commit-infos.component.html',
  styleUrl: './commit-infos.component.scss',
  animations: [slightSlideIn],
})
export class CommitInfosComponent {

  protected editCommitForm = new FormGroup({
    summary: new FormControl(''),
    description: new FormControl(''),
  });
  protected initialValue: typeof this.editCommitForm.value = {};
  protected editedFiles?: ChangeSet;
  protected readonly isEqual = isEqual;
  protected readonly DATE_FORMAT = DATE_FORMAT;
  protected readonly directory = directory;
  protected readonly fileName = fileName;
  protected readonly FileStatusesIcons = FileStatusesIcons;
  protected readonly gitRepositoryStore = inject(GitRepositoryStore);
  private readonly workingDirectoryService = inject(WorkingDirectoryService);
  protected readonly fileDiffPanelService = inject(FileDiffPanelService);

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

  protected readonly file$ = (f: CommittedFileChange) => f;
}
