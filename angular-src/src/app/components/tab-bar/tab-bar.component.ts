import { Component } from '@angular/core';
import { ToolbarModule } from "primeng/toolbar";
import { SplitButtonModule } from "primeng/splitbutton";
import { MenuItem } from "primeng/api";
import { AvatarModule } from "primeng/avatar";
import { TabViewModule } from "primeng/tabview";
import { SettingsService } from "../../services/settings.service";
import { StorePlace } from "../../enums/store-place.enum";

@Component({
    selector: 'gitgud-tab-bar',
    standalone: true,
    imports: [
        ToolbarModule,
        SplitButtonModule,
        AvatarModule,
        TabViewModule
    ],
    templateUrl: './tab-bar.component.html',
    styleUrl: './tab-bar.component.scss'
})
export class TabBarComponent {

    selectedRepoIndex;

    constructor(
        settingsService: SettingsService
    ) {
        this.selectedRepoIndex = settingsService.get<number>(StorePlace.SelectedRepo)
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


}
