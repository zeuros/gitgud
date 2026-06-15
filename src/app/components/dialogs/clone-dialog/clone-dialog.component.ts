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

import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Button} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {FloatLabel} from 'primeng/floatlabel';
import {Tooltip} from 'primeng/tooltip';
import {GitApiService} from '../../../services/electron-cmd-parser-layer/git-api.service';
import {GitRepositoryService} from '../../../services/git-repository.service';
import {ToastService} from '../../../services/toast.service';
import {finalize, type Observable, switchMap} from 'rxjs';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';

export const openCloneDialog = (dialog: DialogService): Observable<void> =>
  dialog.open(CloneDialogComponent, {
    header: 'Clone Repository',
    width: '480px',
    modal: true,
    dismissableMask: true,
  })!.onClose;

@Component({
  selector: 'gitgud-clone-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Button, InputText, FloatLabel, FormsModule, Tooltip],
  templateUrl: './clone-dialog.component.html',
  styleUrl: './clone-dialog.component.scss',
})
export class CloneDialogComponent {

  private gitApi = inject(GitApiService);
  private gitRepository = inject(GitRepositoryService);
  private toast = inject(ToastService);
  protected ref = inject(DynamicDialogRef);

  protected url = signal('');
  protected targetDir = signal('');
  protected repoName = signal('');
  protected loading = signal(false);
  protected repoPath = computed(() => `${this.targetDir()}/${this.repoName()}`);
  protected repoExists = signal(false);

  protected pickDirectory() {
    window.tauri.dialog.showOpenDialog({properties: ['openDirectory']}).then(picked => {
      if (picked?.[0]) this.targetDir.set(picked[0]);
      this.refreshRepoExists();
    });
  }

  private refreshRepoExists() {
    const path = this.repoPath();
    if (!this.targetDir() || !this.repoName()) { this.repoExists.set(false); return; }
    window.tauri.fs.exists(`${path}/.git`).then(e => this.repoExists.set(e));
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
        switchMap(() => this.gitRepository.openRepository(this.repoPath())),
        finalize(() => this.loading.set(false)),
      )
      .subscribe(() => {
        this.ref.close();
        this.toast.success(`Cloned ${this.repoName()} successfully`);
      });
  }

  protected openExisting() {
    this.loading.set(true);
    this.gitRepository.openRepository(this.repoPath())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(() => {
        this.ref.close();
        this.toast.success(`Opened ${this.repoName()}`);
      });
  }
}
