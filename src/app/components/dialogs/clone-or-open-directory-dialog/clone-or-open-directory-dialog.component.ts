import {Component} from '@angular/core';
import {ElectronIpcApiService} from "../../../services/electron-ipc-api.service";
import {PopupService} from "../../../services/popup.service";
import {FieldsetModule} from "primeng/fieldset";
import {ButtonModule} from "primeng/button";
import {FloatLabelModule} from "primeng/floatlabel";
import {InputTextModule} from "primeng/inputtext";
import {FormsModule} from "@angular/forms";
import {PanelModule} from "primeng/panel";
import {CardModule} from "primeng/card";

@Component({
    selector: 'app-clone-or-open-directory-dialog',
    standalone: true,
    imports: [
        FieldsetModule,
        ButtonModule,
        FloatLabelModule,
        InputTextModule,
        FormsModule,
        PanelModule,
        CardModule
    ],
    templateUrl: './clone-or-open-directory-dialog.component.html',
    styleUrl: './clone-or-open-directory-dialog.component.scss'
})
export class CloneOrOpenDirectoryDialogComponent {

    repositoryUrl?: string;

    constructor(
        private electronIpcApiService: ElectronIpcApiService,
        private popupService: PopupService,
    ) {

    }

    protected clone = () => this.electronIpcApiService.clone('https://github.com/isomorphic-git/lightning-fs', 'C:/test-repo')
        .subscribe(() => this.popupService.info('Repository cloned'));

}
