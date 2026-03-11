import {Component, inject} from '@angular/core';
import {RepositoryViewComponent} from './components/repository-view/repository-view.component';
import {TopBarComponent} from './components/top-bar/top-bar.component';
import {CommonModule} from '@angular/common';
import {ToastModule} from 'primeng/toast';
import {Tab, TabList, TabPanel, TabPanels, Tabs} from 'primeng/tabs';
import {GitRepositoryStore} from './stores/git-repos.store';
import {AutoFetchService} from './services/auto-fetch.service';

@Component({
  standalone: true,
  imports: [CommonModule, ToastModule, TopBarComponent, RepositoryViewComponent, Tabs, TabList, Tab, TabPanels, TabPanel],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {

  protected readonly gitRepositoryStore = inject(GitRepositoryStore);

  constructor() {
    inject(AutoFetchService); // Starts auto-fetch

    console.log('Process env: ', window.electron.processEnv);
  }
}
