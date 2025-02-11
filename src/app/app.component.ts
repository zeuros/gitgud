import {Component} from '@angular/core';
import {ElectronService} from './core/services';
import {TranslateService} from '@ngx-translate/core';
import {APP_CONFIG} from '../environments/environment';
import {TabViewModule} from "primeng/tabview";
import {RepositoryViewComponent} from "./components/repository-view/repository-view.component";
import {TopBarComponent} from "./components/top-bar/top-bar.component";
import {CommonModule} from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {ToastModule} from "primeng/toast";
import {GitRepositoryService} from "./services/git-repository.service";

@Component({
  standalone: true,
  imports: [CommonModule, RouterOutlet, ToastModule, TopBarComponent, RepositoryViewComponent, TabViewModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  constructor(
    private electronService: ElectronService,
    private translate: TranslateService,
    protected gitRepositoryService: GitRepositoryService,
  ) {
    this.translate.setDefaultLang('en');
    console.log('APP_CONFIG', APP_CONFIG);

    if (electronService.isElectron) {
      console.log(process.env);
      console.log('Run in electron');
      console.log('Electron ipcRenderer', this.electronService.ipcRenderer);
      console.log('NodeJS childProcess', this.electronService.childProcess);
    } else {
      console.log('Run in browser');
    }
  }
}
