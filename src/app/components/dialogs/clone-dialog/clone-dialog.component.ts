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

import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Button} from 'primeng/button';
import {Dialog} from 'primeng/dialog';
import {InputText} from 'primeng/inputtext';
import {FloatLabel} from 'primeng/floatlabel';
import {PrimeTemplate} from 'primeng/api';
import {GitApiService} from '../../../services/electron-cmd-parser-layer/git-api.service';
import {GitRepositoryService} from '../../../services/git-repository.service';
import {PopupService} from '../../../services/popup.service';
import {finalize, switchMap} from 'rxjs';

@Component({
  selector: 'gitgud-clone-dialog',
  standalone: true,
  imports: [Button, Dialog, InputText, FloatLabel, FormsModule, PrimeTemplate],
  templateUrl: './clone-dialog.component.html',
  styleUrl: './clone-dialog.component.scss',
})
export class CloneDialogComponent {

  private gitApi = inject(GitApiService);
  private gitRepositoryService = inject(GitRepositoryService);
  private popup = inject(PopupService);

  protected visible = signal(false);
  protected url = signal('');
  protected targetDir = signal('');
  protected repoName = signal('');
  protected loading = signal(false);
  protected repoPath = computed(() => `${this.targetDir()}/${this.repoName()}`);
  protected repoExists = computed(() =>
    !!(this.targetDir() && this.repoName() && window.electron.fs.existsSync(`${this.repoPath()}/.git`)),
  );

  open() {
    this.url.set('');
    this.targetDir.set('');
    this.repoName.set('');
    this.visible.set(true);
  }

  protected pickDirectory() {
    const picked = window.electron.dialog.showOpenDialogSync({properties: ['openDirectory']});
    if (picked?.[0]) this.targetDir.set(picked[0]);
  }

  protected onUrlChange(url: string) {
    this.url.set(url);
    if (!this.repoName()) {
      const match = url.match(/\/([^/]+?)(?:\.git)?$/);
      if (match) this.repoName.set(match[1]);
    }
  }

  protected clone() {
    this.loading.set(true);
    this.gitApi.clone(this.url(), this.repoName(), this.targetDir())
      .pipe(
        switchMap(() => this.gitRepositoryService.openRepository(this.repoPath())),
        finalize(() => this.loading.set(false)),
      )
      .subscribe(() => {
        this.visible.set(false);
        this.popup.success(`Cloned ${this.repoName()} successfully`);
      });
  }

  protected openExisting() {
    this.loading.set(true);
    this.gitRepositoryService.openRepository(this.repoPath())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(() => {
        this.visible.set(false);
        this.popup.success(`Opened ${this.repoName()}`);
      });
  }
}
