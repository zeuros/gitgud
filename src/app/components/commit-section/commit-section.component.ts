import {Component, inject} from '@angular/core';
import {ReactiveFormsModule} from '@angular/forms';
import {CommitInfosComponent} from './commit-infos/commit-infos.component';
import {MakeACommitComponent} from './make-a-commit/make-a-commit.component';
import {GitRepositoryStore} from '../../stores/git-repos.store';
import {CommitsFileListInfoComponent} from './commits-file-list-info/commits-file-list-info.component';


@Component({
  selector: 'gitgud-commit-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommitInfosComponent,
    MakeACommitComponent,
    CommitsFileListInfoComponent,
  ],
  templateUrl: './commit-section.component.html',
  styleUrl: './commit-section.component.scss',
})
export class CommitSectionComponent {

  protected readonly gitRepositoryStore = inject(GitRepositoryStore);

}
