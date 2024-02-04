import { Component, Input, OnInit } from '@angular/core';
import { RemotePanelComponent } from "../remote-panel/remote-panel.component";
import { HistoryTreeComponent } from "../history-tree/history-tree.component";
import { CommitSectionComponent } from "../commit-section/commit-section.component";
import { SplitterModule } from "primeng/splitter";

@Component({
    selector: 'gitgud-repository',
    standalone: true,
    imports: [RemotePanelComponent, HistoryTreeComponent, CommitSectionComponent, SplitterModule],
    templateUrl: './repository.component.html',
    styleUrl: './repository.component.scss'
})
export class RepositoryComponent implements OnInit {
    @Input()
    repositoryFolder!: string;

    ngOnInit(): void {
        console.warn(this.repositoryFolder);
    }

}
