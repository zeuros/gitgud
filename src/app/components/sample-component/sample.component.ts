import {Component} from '@angular/core';
import {ElectronService} from "ngx-electron";
import * as electron from "electron";

@Component({
    selector: 'app-sample-component',
    standalone: true,
    templateUrl: './sample.component.html',
    styleUrl: './sample.component.scss'
})
export class SampleComponent {

    constructor(
        private electron: ElectronService
    ) {
    }


    protected test = () => {
        this.electron.ipcRenderer.sendSync('git-clone', 'https://github.com/torch2424/made-with-webassembly.git', 'folder')
    };

}
