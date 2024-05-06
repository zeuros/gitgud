import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {ToastModule} from "primeng/toast";
import {DialogService} from "primeng/dynamicdialog";
import {TopBarComponent} from "./components/top-bar/top-bar.component";

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, RouterOutlet, ToastModule, TopBarComponent],
    providers: [DialogService],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {


}
