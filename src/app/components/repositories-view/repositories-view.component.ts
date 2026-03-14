import {Component, inject} from '@angular/core';
import {Tab, TabList, TabPanel, TabPanels, Tabs} from 'primeng/tabs';
import {Button} from 'primeng/button';
import {RepositoryViewComponent} from '../repository-view/repository-view.component';
import {GitRepositoryStore} from '../../stores/git-repos.store';
import {GitRepositoryService} from '../../services/git-repository.service';

@Component({
  selector: 'gitgud-repositories-view',
  imports: [
    Tabs,
    TabList,
    Tab,
    Button,
    TabPanels,
    TabPanel,
    RepositoryViewComponent,
  ],
  templateUrl: './repositories-view.component.html',
  styleUrl: './repositories-view.component.scss',
  host: {
    class: 'fill-height',
  },
})
export class RepositoriesViewComponent {
  protected readonly gitRepositoryStore = inject(GitRepositoryStore);
  protected readonly gitRepositoryService = inject(GitRepositoryService);
}
