import {Component, inject} from '@angular/core';
import {CloneOrOpenDirectoryDialogComponent} from '../dialogs/clone-or-open-directory-dialog/clone-or-open-directory-dialog.component';
import {GitRepositoryService} from '../../services/git-repository.service';
import {ButtonModule} from 'primeng/button';
import {DialogModule} from 'primeng/dialog';
import {DialogService} from 'primeng/dynamicdialog';

@Component({
  selector: 'gitgud-top-bar',
  standalone: true,
  imports: [ButtonModule, DialogModule],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {

  protected readonly gitRepositoryService = inject(GitRepositoryService);
  private readonly dialogService = inject(DialogService);

  protected readonly showOpenOrCloneModal = () =>
    this.dialogService.open(CloneOrOpenDirectoryDialogComponent, {header: 'Clone a repository', width: '50vw', modal: true});

}
