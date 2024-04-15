import {Component} from '@angular/core';
import {ipcMain} from 'electron';

@Component({
    selector: 'app-sample-component',
    standalone: true,
    templateUrl: './sample.component.html',
    styleUrl: './sample.component.scss',
})
export class SampleComponent {

    constructor() {
    }

    protected test = () => {
        debugger
        console.log((window as any).versions.node());
        //ipcRenderer.sendSync('git-clone', 'https://github.com/torch2424/made-with-webassembly.git', 'folder')
    };

}
