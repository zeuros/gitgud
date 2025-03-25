import {Component, Input} from '@angular/core';
import {RemotePanelComponent} from "../remote-panel/remote-panel.component";
import {SplitterModule} from "primeng/splitter";
import {GitRepositoryService} from "../../services/git-repository.service";
import {CommitSectionComponent} from "../commit-section/commit-section.component";
import {LogsComponent} from "../logs/logs.component";
import {GitRepository} from "../../models/git-repository";
import {Observable} from "rxjs";
import {AsyncPipe} from "@angular/common";

@Component({
    selector: 'gitgud-repository-view',
    standalone: true,
  imports: [RemotePanelComponent, LogsComponent, CommitSectionComponent, SplitterModule, AsyncPipe],
    templateUrl: './repository-view.component.html',
    styleUrl: './repository-view.component.scss'
})
export class RepositoryViewComponent {

    @Input() gitRepository$!: Observable<GitRepository>;

    constructor(
        protected gitRepositoryService: GitRepositoryService,
    ) {
    }

    savePanelSizes = (sizes: number[]) => this.gitRepositoryService.updateCurrentRepository({sizes});
}
