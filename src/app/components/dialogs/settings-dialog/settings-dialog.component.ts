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
import {Button} from 'primeng/button';
import {Dialog} from 'primeng/dialog';
import {InputNumber} from 'primeng/inputnumber';
import {InputText} from 'primeng/inputtext';
import {Select} from 'primeng/select';
import {FormsModule} from '@angular/forms';
import {SettingsService} from '../../../services/settings.service';
import {GitApiService} from '../../../services/electron-cmd-parser-layer/git-api.service';
import {ThemeService} from '../../../services/theme.service';
import {catchError, forkJoin, of, throwError} from 'rxjs';
import {Tooltip} from 'primeng/tooltip';
import {emptyStringOnFail} from '../../../utils/utils';
import {PopupService} from '../../../services/popup.service';
import {CurrentRepoStore} from '../../../stores/current-repo.store';

@Component({
  selector: 'gitgud-settings-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Button, Dialog, InputNumber, InputText, Select, FormsModule, Tooltip],
  templateUrl: './settings-dialog.component.html',
  styleUrl: './settings-dialog.component.scss',
})
export class SettingsDialogComponent {

  private gitApi = inject(GitApiService);
  private currentRepo = inject(CurrentRepoStore);
  private popup = inject(PopupService);

  protected settings = inject(SettingsService);
  protected theme = inject(ThemeService);
  protected visible = signal(false);
  protected globalUserName = signal('');
  protected globalUserEmail = signal('');
  protected localUserName = signal('');
  protected localUserEmail = signal('');
  protected hasRepo = computed(() => !!this.currentRepo.cwd());
  protected pendingGitPath = signal('');
  protected gitPathDirty = computed(() => this.pendingGitPath() !== this.settings.gitBin);
  protected gitVersion = signal('');

  open() {
    this.visible.set(true);

    this.pendingGitPath.set(this.settings.gitBin);
    this.gitApi.git(['--version']).pipe(emptyStringOnFail).subscribe(v => this.gitVersion.set(v.trim()));
    forkJoin({
      globalName: this.gitApi.git(['config', '--global', 'user.name']).pipe(emptyStringOnFail),
      globalEmail: this.gitApi.git(['config', '--global', 'user.email']).pipe(emptyStringOnFail),
      ...(this.hasRepo() ? {
        localName: this.gitApi.git(['config', '--local', 'user.name']).pipe(emptyStringOnFail),
        localEmail: this.gitApi.git(['config', '--local', 'user.email']).pipe(emptyStringOnFail),
      } : {}),
    }).subscribe(({globalName, globalEmail, localEmail, localName}) => {
      console.log({localName, globalName});
      this.globalUserName.set(globalName.trim());
      this.globalUserEmail.set(globalEmail.trim());
      this.localUserName.set((localName ?? '').trim());
      this.localUserEmail.set((localEmail ?? '').trim());
    });
  }

  protected pickGitBinaryPath() {
    const picked = window.electron.dialog.showOpenDialogSync({
      properties: ['openFile'],
      filters: [{name: 'Executables', extensions: ['*']}],
    });

    if (!picked?.[0]) return;

    this.checkGitPathIsValid(picked[0]);
  }

  protected validateGitPath() {
    const candidate = this.pendingGitPath().trim();
    if (!candidate) return;
    this.checkGitPathIsValid(candidate);
  }

  protected saveGlobalName() {
    const v = this.globalUserName().trim();
    if (v) this.gitApi.gitAction(['config', '--global', 'user.name', v]).subscribe();
  }

  protected saveGlobalEmail() {
    const v = this.globalUserEmail().trim();
    if (v) this.gitApi.gitAction(['config', '--global', 'user.email', v]).subscribe();
  }

  protected saveLocalName() {
    if (!this.hasRepo()) return;
    const v = this.localUserName().trim();
    const args = v ? ['config', '--local', 'user.name', v] : ['config', '--local', '--unset', 'user.name'];
    this.gitApi.gitAction(args).pipe(catchError(e => e?.code === 5 ? of('') : throwError(() => e)))
      .subscribe({error: e => this.popup.err(`Failed to set local user name: ${e?.message ?? e}`)});
  }

  protected saveLocalEmail() {
    if (!this.hasRepo()) return;
    const v = this.localUserEmail().trim();
    const args = v ? ['config', '--local', 'user.email', v] : ['config', '--local', '--unset', 'user.email'];
    this.gitApi.gitAction(args).pipe(catchError(e => e?.code === 5 ? of('') : throwError(() => e)))
      .subscribe({error: e => this.popup.err(`Failed to set local email: ${e?.message ?? e}`)});
  }

  private checkGitPathIsValid(candidate: string) {
    const previous = this.settings.gitBin;

    this.gitApi.git(['--version']).subscribe({
      next: v => {
        this.settings.gitBin = candidate;
        this.gitVersion.set(v.trim())
      },
      error: () => {
        this.settings.gitBin = previous;
        this.pendingGitPath.set(previous);
        this.popup.err('The entered path does not appear to be a valid git executable.');
      },
    });
  }

}
