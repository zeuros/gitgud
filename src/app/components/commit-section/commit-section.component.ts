import {Component, inject} from '@angular/core';
import {ReactiveFormsModule} from '@angular/forms';
import {CommitInfosComponent} from './commit-infos/commit-infos.component';
import {MakeACommitComponent} from './make-a-commit/make-a-commit.component';
import {GitRepositoryStore} from '../../stores/git-repos.store';


@Component({
  selector: 'gitgud-commit-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommitInfosComponent,
    MakeACommitComponent,
  ],
  templateUrl: './commit-section.component.html',
  styleUrl: './commit-section.component.scss',
})
export class CommitSectionComponent {

  protected readonly gitRepositoryStore = inject(GitRepositoryStore);

}
