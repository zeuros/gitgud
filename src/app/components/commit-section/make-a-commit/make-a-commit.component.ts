import {Component, inject} from '@angular/core';
import {Divider} from 'primeng/divider';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {Textarea} from 'primeng/textarea';
import {Button} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {WorkingDirectoryService} from '../../../services/electron-cmd-parser-layer/working-directory.service';
import {Listbox} from 'primeng/listbox';
import {FileStatusesIcons, WorkingDirectoryFileChange} from '../../../lib/github-desktop/model/status';
import {directory, fileName} from '../../../utils/utils';
import {FileDiffPanelService} from '../../../services/file-diff-panel.service';
import {PrimeTemplate} from 'primeng/api';
import {GitRepositoryStore} from '../../../stores/git-repos.store';
import {CommitService} from '../../../services/commit.service';
import {Checkbox} from 'primeng/checkbox';
import {headCommit} from '../../../utils/commit-utils';
import {Splitter, SplitterResizeEndEvent} from 'primeng/splitter';

@Component({
  selector: 'gitgud-make-a-commit',
  imports: [
    Divider,
    ReactiveFormsModule,
    Textarea,
    InputText,
    Listbox,
    Button,
    PrimeTemplate,
    Checkbox,
    Splitter,
  ],
  templateUrl: './make-a-commit.component.html',
  styleUrl: './make-a-commit.component.scss',
})
export class MakeACommitComponent {

  protected fileDiffPanelService = inject(FileDiffPanelService);
  protected workingDirectoryService = inject(WorkingDirectoryService);
  protected gitRepositoryStore = inject(GitRepositoryStore);
  private commitService = inject(CommitService);
  private savedFormState?: typeof this.commitForm.value;
  protected commitForm = inject(FormBuilder).nonNullable.group({summary: '', description: ''});
  protected amend = false;

  protected commit() {
    const {summary, description} = this.commitForm.value;

    this.commitService.commit(summary!, description?.length ? description : undefined, this.amend);
  }

  protected amendMode(amend: boolean) {
    this.amend = amend;
    if (amend) {
      // Save current form state
      this.savedFormState = this.commitForm.value;

      // Prefill with last commit message
      const lastCommit = headCommit(this.gitRepositoryStore.branches(), this.gitRepositoryStore.logs()); // HEAD;
      if (lastCommit) {
        this.commitForm.patchValue({
          summary: lastCommit.summary,
          description: lastCommit.body ?? '',
        });
      }
    } else {
      // Restore saved state
      if (this.savedFormState) {
        this.commitForm.patchValue(this.savedFormState);
        this.savedFormState = undefined;
      }
    }
  }

  protected savePanelSizes = ({sizes}: SplitterResizeEndEvent) =>
    this.gitRepositoryStore.updateSelectedRepository({panelSizes: {...this.gitRepositoryStore.panelSizes()!, makeCommitPanel: sizes.map(Number)}});

  protected FileStatusesIcons = FileStatusesIcons;
  protected keys = Object.keys;
  protected directory = directory;
  protected fileName = fileName;
  protected $WorkDirFileChanges = (w: WorkingDirectoryFileChange) => w;
}
