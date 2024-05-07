import {Component, Input} from '@angular/core';
import {RemotePanelComponent} from "../remote-panel/remote-panel.component";
import {SplitterModule} from "primeng/splitter";
import {GitRepositoryService} from "../../services/git-repository.service";
import {CommitSectionComponent} from "../commit-section/commit-section.component";
import {HistoryTreeComponent} from "../history-tree/history-tree.component";
import {GitRepository} from "../../models/git-repository";

@Component({
    selector: 'gitgud-repository-view',
    standalone: true,
    imports: [RemotePanelComponent, HistoryTreeComponent, CommitSectionComponent, SplitterModule],
    templateUrl: './repository-view.component.html',
    styleUrl: './repository-view.component.scss'
})
export class RepositoryViewComponent {

    @Input() gitRepository!: GitRepository;

    constructor(
        protected gitRepositoryService: GitRepositoryService,
    ) {
    }

    savePanelSizes = (sizes: number[]) => this.gitRepositoryService.saveCurrentRepository({sizes});
}
