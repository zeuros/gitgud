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
  private draggedIndex: number | null = null;
  private throttled = false;

  protected onDragStart(event: DragEvent, index: number): void {
    this.draggedIndex = index;
    event.dataTransfer!.effectAllowed = 'linkMove';
  }

  protected onDragOver(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    if (this.draggedIndex === null || targetIndex === this.draggedIndex || this.throttled) return;

    this.throttled = true;
    this.gitRepositoryStore.reorderRepositories(this.draggedIndex, targetIndex);
    this.draggedIndex = targetIndex;
    setTimeout(() => this.throttled = false, 300);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.cleanup();
  }

  protected onDragEnd(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.draggedIndex = null;
    this.throttled = false;
  }

  protected onMiddleClick(event: MouseEvent, index: number): void {
    if (event.button === 1) {
      event.preventDefault();
      this.gitRepositoryStore.removeRepository(index);
    }
  }
}
