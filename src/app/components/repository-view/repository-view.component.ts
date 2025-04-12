import {Component, Input} from '@angular/core';
import {BranchesComponent} from "../branches/branches.component";
import {SplitterModule} from "primeng/splitter";
import {GitRepositoryService} from "../../services/git-repository.service";
import {CommitSectionComponent} from "../commit-section/commit-section.component";
import {LogsComponent} from "../logs/logs.component";
import {GitRepository} from "../../models/git-repository";

@Component({
  selector: 'gitgud-repository-view',
  standalone: true,
  imports: [BranchesComponent, LogsComponent, CommitSectionComponent, SplitterModule],
  templateUrl: './repository-view.component.html',
  styleUrl: './repository-view.component.scss'
})
export class RepositoryViewComponent {

  @Input() gitRepository!: GitRepository;

  constructor(
    protected gitRepositoryService: GitRepositoryService,
  ) {
  }

  savePanelSizes = (sizes: number[]) => this.gitRepositoryService.updateCurrentRepository({sizes});
}
