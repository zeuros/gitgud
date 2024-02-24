import { Component, Input } from '@angular/core';
import { RemotePanelComponent } from "../remote-panel/remote-panel.component";
import { HistoryTreeComponent } from "../history-tree/history-tree.component";
import { CommitSectionComponent } from "../commit-section/commit-section.component";
import { SplitterModule } from "primeng/splitter";
import { GitRepositoryService } from "../../services/git-repository.service";
import { GitRepository } from "../../models/git-repository";

@Component({
    selector: 'gitgud-repository',
    standalone: true,
    imports: [RemotePanelComponent, HistoryTreeComponent, CommitSectionComponent, SplitterModule],
    templateUrl: './repository.component.html',
    styleUrl: './repository.component.scss'
})
export class RepositoryComponent {

    @Input()
    repository?: GitRepository;

    constructor(
        protected gitRepositoryService: GitRepositoryService,
    ) {
    }

    savePanelSizes = (sizes: number[]) => this.gitRepositoryService.saveRepository(this.repository!.name, {sizes});
}
