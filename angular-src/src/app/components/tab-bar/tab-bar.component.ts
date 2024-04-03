import {Component} from '@angular/core';
import {ToolbarModule} from "primeng/toolbar";
import {SplitButtonModule} from "primeng/splitbutton";
import {MenuItem} from "primeng/api";
import {AvatarModule} from "primeng/avatar";
import {TabViewModule} from "primeng/tabview";
import {StorePlace} from "../../enums/store-place.enum";
import {SettingsService} from "../../services/settings.service";
import {GitRepositoryService} from "../../services/git-repository.service";
import {RepositoryComponent} from "../repository/repository.component";
import {RippleModule} from "primeng/ripple";
import {NgForOf} from "@angular/common";

@Component({
    selector: 'gitgud-tab-bar',
    standalone: true,
    imports: [
        ToolbarModule,
        SplitButtonModule,
        AvatarModule,
        TabViewModule,
        RepositoryComponent,
        RippleModule,
        NgForOf,
    ],
    templateUrl: './tab-bar.component.html',
    styleUrl: './tab-bar.component.scss'
})
export class TabBarComponent {

    selectedRepoIndex;

    constructor(
        private settingsService: SettingsService,
        protected gitRepositoryService: GitRepositoryService,
    ) {
        this.selectedRepoIndex = settingsService.get<number>(StorePlace.SelectedGitRepository)
    }

    items: MenuItem[] = [
        {
            label: 'Update',
            icon: 'pi pi-refresh'
        },
        {
            label: 'Delete',
            icon: 'pi pi-times'
        }
    ];


    removeRepository = (repositoryIndex: number) => this.gitRepositoryService.removeRepository(this.gitRepositoryService.repositories[repositoryIndex].directory);

    selectGitRepository(indexOfRepo: number) {
        // ...
    }
}
