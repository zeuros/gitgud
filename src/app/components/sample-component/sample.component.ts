import {Component} from '@angular/core';
import {GitToolsService} from "../../services/git-tools.service";
import {PopupService} from "../../services/popup.service";

@Component({
    selector: 'app-sample-component',
    standalone: true,
    templateUrl: './sample.component.html',
    styleUrl: './sample.component.scss',
})
export class SampleComponent {

    constructor(
        protected gitToolsService: GitToolsService,
        protected popupService: PopupService,
    ) {
    }

    protected test = () => this.gitToolsService.clone('https://github.com/isomorphic-git/lightning-fs', 'C:/test-repo')
        .subscribe(() => this.popupService.info('Repository cloned'));

}
