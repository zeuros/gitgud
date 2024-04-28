import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {SampleComponent} from "./components/sample-component/sample.component";
import {ToastModule} from "primeng/toast";
import {TabMenuModule} from "primeng/tabmenu";
import {MenuItem} from "primeng/api";
import {ButtonModule} from "primeng/button";
import {DialogService, DynamicDialogRef} from "primeng/dynamicdialog";
import {CloneOrOpenDirectoryDialogComponent} from "./components/dialogs/clone-or-open-directory-dialog/clone-or-open-directory-dialog.component";
import {DialogModule} from "primeng/dialog";

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, RouterOutlet, SampleComponent, ToastModule, TabMenuModule, ButtonModule, DialogModule],
    providers: [DialogService],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {

    protected repositoriesTabs: MenuItem[] = [];
    activeItemIndex: MenuItem | undefined;

    cloneOrOpenDirectoryDialogRef: DynamicDialogRef | undefined;

    constructor(
        private dialogService: DialogService,
    ) {
        this.repositoriesTabs = JSON.parse(localStorage.getItem('repositories-tabs')!) ?? [] as MenuItem[];
    }

    protected showOpenOrCloneModal = () => {
        this.cloneOrOpenDirectoryDialogRef = this.dialogService.open(CloneOrOpenDirectoryDialogComponent, {
            header: 'Clone or open a repository',
            width: '50vw',
            modal: true,
        });
    };


}
