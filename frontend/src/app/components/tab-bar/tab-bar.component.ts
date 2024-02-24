import { Component } from '@angular/core';
import { ToolbarModule } from "primeng/toolbar";
import { SplitButtonModule } from "primeng/splitbutton";
import { AvatarModule } from "primeng/avatar";
import { TabViewModule } from "primeng/tabview";
import { SettingsService } from "../../services/settings.service";
import { StorageName } from "../../enums/storage-name.enum";
import { RepositoryComponent } from "../repository/repository.component";
import { AsyncPipe, NgForOf } from "@angular/common";
import { GitRepositoryService } from "../../services/git-repository.service";
import { RippleModule } from "primeng/ripple";

@Component({
    selector: 'gitgud-tab-bar',
    standalone: true,
    imports: [
        ToolbarModule,
        SplitButtonModule,
        AvatarModule,
        TabViewModule,
        RepositoryComponent,
        NgForOf,
        AsyncPipe,
        RippleModule,
    ],
    templateUrl: './tab-bar.component.html',
    styleUrl: './tab-bar.component.scss'
})
export class TabBarComponent {

    selectedGitRepositoryIndex: number;

    constructor(
        private settingsService: SettingsService,
        protected gitRepositoryService: GitRepositoryService,
    ) {
        this.selectedGitRepositoryIndex = settingsService.get<number>(StorageName.SelectedGitRepository) ?? 0;
    }

    changeSelectedGitRepositoryIndex = (index: number) => this.gitRepositoryService.selectRepository(index);


    removeRepository = (repositoryIndex: number) => this.gitRepositoryService.removeRepository(this.gitRepositoryService.repositories[repositoryIndex].directory);
}
