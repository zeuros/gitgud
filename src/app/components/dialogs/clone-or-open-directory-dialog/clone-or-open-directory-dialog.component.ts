/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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


  private gitApi = inject(GitApiService);
  private popup = inject(PopupService);

  repositoryUrl = model<string>();

  protected clone = (url: string) => this.gitApi.clone(url, '', '')
    .subscribe(() => this.popup.info('Repository cloned'));

}
