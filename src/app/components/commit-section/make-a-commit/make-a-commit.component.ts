import {Component, inject} from '@angular/core';
import {Divider} from 'primeng/divider';
import {FormControl, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {Textarea} from 'primeng/textarea';
import {Button, ButtonDirective} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {WorkingDirectoryService} from '../../../services/electron-cmd-parser-layer/working-directory.service';
import {Listbox} from 'primeng/listbox';
import {FileStatusesIcons, WorkingDirectoryFileChange} from '../../../lib/github-desktop/model/status';
import {directory, fileName} from '../../../utils/utils';
import {FileDiffPanelService} from '../../../services/file-diff-panel.service';
import {slightSlideIn} from '../../../shared/animations';
import {PrimeTemplate} from 'primeng/api';
import {GitRepositoryStore} from '../../../stores/git-repos.store';

@Component({
  selector: 'gitgud-make-a-commit',
  imports: [
    Divider,
    ReactiveFormsModule,
    Textarea,
    ButtonDirective,
    InputText,
    Listbox,
    Button,
    PrimeTemplate,
  ],
  templateUrl: './make-a-commit.component.html',
  styleUrl: './make-a-commit.component.scss',
  animations: [slightSlideIn],
})
export class MakeACommitComponent {

  protected readonly directory = directory;
  protected readonly fileName = fileName;
  protected readonly commitForm = new FormGroup({
    summary: new FormControl(''),
    description: new FormControl(''),
  });
  protected readonly keys = Object.keys;
  protected readonly FileStatusesIcons = FileStatusesIcons;
  protected readonly fileDiffPanelService = inject(FileDiffPanelService);
  protected readonly workingDirectoryService = inject(WorkingDirectoryService);
  protected readonly gitRepositoryStore = inject(GitRepositoryStore);

  protected readonly $WorkDirFileChanges = (w: WorkingDirectoryFileChange) => w;
}
