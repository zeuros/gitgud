import {Component} from '@angular/core';
import {ipcMain} from 'electron';
import {GitTools} from "../../models/git-tools";
import {catchError, from} from "rxjs";
import {GitToolsService} from "../../services/git-tools.service";

@Component({
    selector: 'app-sample-component',
    standalone: true,
    templateUrl: './sample.component.html',
    styleUrl: './sample.component.scss',
})
export class SampleComponent {

    constructor(
        protected gitToolsService: GitToolsService,
    ) {
    }

    protected test = () => this.gitToolsService.clone('https://github.com/isomorphic-git/lightning-fs', 'C:/test-repo')
            .subscribe(() => console.log('repo cloned !'));

}
