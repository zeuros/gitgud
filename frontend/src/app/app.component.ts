import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {TabBarComponent} from "./components/tab-bar/tab-bar.component";
import {ButtonModule} from "primeng/button";
import {BottomBarComponent} from "./components/bottom-bar/bottom-bar.component";

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, RouterOutlet, TabBarComponent, ButtonModule, BottomBarComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
}
