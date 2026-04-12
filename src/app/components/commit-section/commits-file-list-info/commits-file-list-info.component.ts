import {Component, effect, inject, signal} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {directory, fileName} from '../../../utils/utils';
import {ChangeSet} from '../../../lib/github-desktop/model/change-set';
import {CurrentRepoStore} from '../../../stores/current-repo.store';
import {FileDiffService} from '../../../services/file-diff.service';
import {CommitCardComponent} from '../commit-line/commit-card.component';
import {Divider} from 'primeng/divider';
import {CommitFileListComponent} from '../commit-file-list/commit-file-list';

@Component({
  selector: 'gitgud-commits-file-list-info',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    CommitCardComponent,
    Divider,
    CommitFileListComponent,
  ],
  templateUrl: './commits-file-list-info.component.html',
  standalone: true,
  host: {
    class: 'fill-height',
  },
})
export class CommitsFileListInfoComponent {
  protected editedFiles = signal<ChangeSet | undefined>(undefined);

  protected directory = directory;
  protected fileName = fileName;

  protected currentRepo = inject(CurrentRepoStore);
  private fileDiff = inject(FileDiffService);

  constructor() {
    effect(() => {
      const selectedCommits = this.currentRepo.selectedCommits();

      if (selectedCommits && selectedCommits.length > 1) {
        this.fileDiff.getChangedFilesForGivenCommits(selectedCommits.map(c => c.sha))
          .subscribe(editedFiles => this.editedFiles.set(editedFiles));
      }
    });
  }

}