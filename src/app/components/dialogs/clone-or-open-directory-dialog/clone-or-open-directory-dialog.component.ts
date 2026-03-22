import {Component, inject, model} from '@angular/core';
import {PopupService} from '../../../services/popup.service';
import {FieldsetModule} from 'primeng/fieldset';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {FormsModule} from '@angular/forms';
import {PanelModule} from 'primeng/panel';
import {CardModule} from 'primeng/card';
import {GitApiService} from '../../../services/electron-cmd-parser-layer/git-api.service';
import {FloatLabelModule} from 'primeng/floatlabel';

@Component({
  selector: 'gitgud-clone-or-open-directory-dialog',
  standalone: true,
  imports: [
    FieldsetModule,
    ButtonModule,
    InputTextModule,
    FormsModule,
    PanelModule,
    CardModule,
    FloatLabelModule,
  ],
  templateUrl: './clone-or-open-directory-dialog.component.html',
  styleUrl: './clone-or-open-directory-dialog.component.scss',
})
export class CloneOrOpenDirectoryDialogComponent {


  private readonly gitApi = inject(GitApiService);
  private readonly popup = inject(PopupService);

  repositoryUrl = model<string>();

  protected clone = (url: string) => this.gitApi.clone(url, '', '')
    .subscribe(() => this.popup.info('Repository cloned'));

}
