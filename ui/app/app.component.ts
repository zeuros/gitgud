import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {ToastModule} from "primeng/toast";
import {DialogService} from "primeng/dynamicdialog";
import {TopBarComponent} from "./components/top-bar/top-bar.component";
import {RepositoryViewComponent} from "./components/repository-view/repository-view.component";
import {TabViewModule} from "primeng/tabview";
import {GitRepositoryService} from "./services/git-repository.service";

@Component({
    selector: 'gitgud-root',
    standalone: true,
    imports: [CommonModule, RouterOutlet, ToastModule, TopBarComponent, RepositoryViewComponent, TabViewModule],
    providers: [DialogService],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {

    constructor(
        protected gitRepositoryService: GitRepositoryService,
    ) {
    }

}
