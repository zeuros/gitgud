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
    ) {
    }


}
