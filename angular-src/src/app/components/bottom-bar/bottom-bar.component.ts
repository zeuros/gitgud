import { Component } from '@angular/core';
import { AsyncPipe } from "@angular/common";

@Component({
    selector: 'gitgud-bottom-bar',
    standalone: true,
    templateUrl: './bottom-bar.component.html',
    imports: [
        AsyncPipe
    ],
    styleUrl: './bottom-bar.component.scss'
})
export class BottomBarComponent {

    version = '1.0.0';

}
