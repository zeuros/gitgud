import {Component} from '@angular/core';
import {DialogModule} from "primeng/dialog";
import {ButtonModule} from "primeng/button";
import {TabMenuModule} from "primeng/tabmenu";
import {MenuItem} from "primeng/api";
import {DialogService, DynamicDialogRef} from "primeng/dynamicdialog";
import {ElectronIpcApiService} from "../../services/electron-ipc-api.service";
import {CloneOrOpenDirectoryDialogComponent} from "../dialogs/clone-or-open-directory-dialog/clone-or-open-directory-dialog.component";

@Component({
    selector: 'app-top-bar',
    standalone: true,
    imports: [TabMenuModule, ButtonModule, DialogModule],
    templateUrl: './top-bar.component.html',
    styleUrl: './top-bar.component.scss'
})
export class TopBarComponent {

    protected repositoriesTabs: MenuItem[] = [];
    activeItemIndex: MenuItem | undefined;

    cloneOrOpenDirectoryDialogRef: DynamicDialogRef | undefined;

    constructor(
        private dialogService: DialogService,
        private electronApiService: ElectronIpcApiService,
    ) {
        this.repositoriesTabs = JSON.parse(localStorage.getItem('repositories-tabs')!) ?? [] as MenuItem[];
    }

    protected openExistingRepository = () => {
        this.electronApiService.openFolderPicker().subscribe(selectedFolder => {
            console.log(selectedFolder);
        });
    };

    protected showOpenOrCloneModal = () => {
        this.cloneOrOpenDirectoryDialogRef = this.dialogService.open(CloneOrOpenDirectoryDialogComponent, {
            header: 'Clone a repository',
            width: '50vw',
            modal: true,
        });
    };

}
