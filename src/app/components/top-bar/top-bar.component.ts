import {Component} from '@angular/core';
import {DialogModule} from "primeng/dialog";
import {ButtonModule} from "primeng/button";
import {TabMenuModule} from "primeng/tabmenu";
import {DialogService, DynamicDialogRef} from "primeng/dynamicdialog";
import {CloneOrOpenDirectoryDialogComponent} from "../dialogs/clone-or-open-directory-dialog/clone-or-open-directory-dialog.component";
import {GitRepositoryService} from "../../services/git-repository.service";
import {PopupService} from "../../services/popup.service";

@Component({
  selector: 'gitgud-top-bar',
  standalone: true,
  imports: [TabMenuModule, ButtonModule, DialogModule],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss'
})
export class TopBarComponent {

  cloneOrOpenDirectoryDialogRef: DynamicDialogRef | undefined;

  constructor(
    private dialogService: DialogService,
    private popupService: PopupService,
    private gitRepositoryService: GitRepositoryService,
  ) {
  }

  openRepo = () => this.gitRepositoryService.openRepository()
    .subscribe({error: this.popupService.warn});

  protected showOpenOrCloneModal = () => {
    this.cloneOrOpenDirectoryDialogRef = this.dialogService.open(CloneOrOpenDirectoryDialogComponent, {
      header: 'Clone a repository',
      width: '50vw',
      modal: true,
    });
  };

}
