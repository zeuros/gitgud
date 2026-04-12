import {Component, effect, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ToastModule} from 'primeng/toast';
import {GitRepositoryStore} from './stores/git-repos.store';
import {AutoFetchService} from './services/auto-fetch.service';
import {Router, RouterOutlet} from '@angular/router';
import {SettingsComponent} from './components/settings/settings.component';

@Component({
  standalone: true,
  imports: [CommonModule, ToastModule, RouterOutlet, SettingsComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {

  private readonly gitRepositoryStore = inject(GitRepositoryStore);
  private readonly router = inject(Router);

  constructor() {
    inject(AutoFetchService); // Starts auto-fetch

    effect(() => this.router.navigate([this.gitRepositoryStore.hasRepositories() ? 'repo' : 'welcome-screen']));

    console.log('Process env: ', window.electron.process.env);
  }
}
