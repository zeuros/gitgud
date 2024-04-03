import {Component} from '@angular/core';

@Component({
    selector: 'app-sample-component',
    standalone: true,
    templateUrl: './sample.component.html',
    styleUrl: './sample.component.scss'
})
export class SampleComponent {

    protected test = () => {
    };

}
