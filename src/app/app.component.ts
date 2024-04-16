import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {SampleComponent} from "./components/sample-component/sample.component";
import {ToastModule} from "primeng/toast";

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, RouterOutlet, SampleComponent, ToastModule],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
}
