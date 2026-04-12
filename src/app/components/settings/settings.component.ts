import {Component, inject, signal} from '@angular/core';
import {Button} from 'primeng/button';
import {Dialog} from 'primeng/dialog';
import {InputNumber} from 'primeng/inputnumber';
import {FormsModule} from '@angular/forms';
import {PrimeTemplate} from 'primeng/api';
import {GitRepositoryStore} from '../../stores/git-repos.store';

@Component({
  selector: 'gitgud-settings',
  standalone: true,
  imports: [Button, Dialog, InputNumber, FormsModule, PrimeTemplate],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {

  private readonly gitRepositoryStore = inject(GitRepositoryStore);

  protected readonly visible = signal(false);
  protected readonly autoFetchInterval = signal(0);
  protected readonly zoom = signal(1);

  open() {
    this.autoFetchInterval.set(this.gitRepositoryStore.config().autoFetchInterval / 1000);
    this.visible.set(true);
  }

  protected save() {
    this.gitRepositoryStore.updateAppConfig({autoFetchInterval: this.autoFetchInterval() * 1000});
    localStorage.setItem('zoom', String(this.zoom()));
    this.visible.set(false);
  }
}
