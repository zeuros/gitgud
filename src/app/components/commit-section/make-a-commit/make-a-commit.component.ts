import {Component, inject} from '@angular/core';
import {Divider} from 'primeng/divider';
import {FormControl, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {Textarea} from 'primeng/textarea';
import {ButtonDirective} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {CommitFilesChangesService} from '../../../services/electron-cmd-parser-layer/commit-files-changes.service';
import {Listbox} from 'primeng/listbox';
import {FileStatusesIcons, WorkingDirectoryFileChange} from '../../../lib/github-desktop/model/status';
import {directory, fileName} from '../../../utils/utils';
import {AsyncPipe} from '@angular/common';
import {FileDiffPanelService} from '../../../services/file-diff-panel.service';
import {slightSlideIn} from '../../../shared/animations';

@Component({
  selector: 'gitgud-make-a-commit',
  imports: [
    Divider,
    ReactiveFormsModule,
    Textarea,
    ButtonDirective,
    InputText,
    Listbox,
    AsyncPipe,
  ],
  templateUrl: './make-a-commit.component.html',
  styleUrl: './make-a-commit.component.scss',
  animations: [slightSlideIn],
})
export class MakeACommitComponent {

  protected readonly directory = directory;
  protected readonly fileName = fileName;
  protected commitForm = new FormGroup({
    summary: new FormControl(''),
    description: new FormControl(''),
  });
  protected readonly keys = Object.keys;
  protected readonly FileStatusesIcons = FileStatusesIcons;
  protected readonly fileDiffPanelService = inject(FileDiffPanelService);
  private readonly commitFilesChangesService = inject(CommitFilesChangesService);
  protected readonly workDirChanges$ = this.commitFilesChangesService.workingDirChanges();

  protected readonly $WorkDirFileChanges = (w: WorkingDirectoryFileChange) => w;
}
