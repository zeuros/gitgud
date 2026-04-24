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

import {Component, computed, inject, OnInit, signal, viewChild} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {finalize, interval, map, switchMap} from 'rxjs';
import {Button} from 'primeng/button';
import {Divider} from 'primeng/divider';
import {Tooltip} from 'primeng/tooltip';
import {Select} from 'primeng/select';
import {FormsModule} from '@angular/forms';
import {GitApiService} from '../../services/electron-cmd-parser-layer/git-api.service';
import {GitRefreshService} from '../../services/git-refresh.service';
import {PopupService} from '../../services/popup.service';
import {PrimeTemplate} from 'primeng/api';
import {AutoFetchService} from '../../services/auto-fetch.service';
import {SettingsDialogComponent} from '../dialogs/settings-dialog/settings-dialog.component';
import {SettingsService} from '../../services/settings.service';
import {short} from '../../utils/commit-utils';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {CloneDialogComponent} from '../dialogs/clone-dialog/clone-dialog.component';
import {ShellHistoryDialogComponent} from '../dialogs/shell-history-dialog/shell-history-dialog.component';

@Component({
  selector: 'gitgud-toolbar',
  standalone: true,
  imports: [Button, Divider, Tooltip, Select, FormsModule, PrimeTemplate, CloneDialogComponent, ShellHistoryDialogComponent, SettingsDialogComponent],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
})
export class ToolbarComponent implements OnInit {

  protected currentRepo = inject(CurrentRepoStore);
  protected autoFetchService = inject(AutoFetchService);
  protected settingsService = inject(SettingsService);
  protected loading = signal<'push' | 'pull' | 'fetch' | undefined>(undefined);
  protected undoTooltip = signal('Undo last action');
  protected redoTooltip = signal('Nothing to redo');
  protected redoAvailable = signal(false);
  protected readonly short = short;
  protected readonly zoomLevels = [70, 80, 90, 100, 110, 120, 130, 140, 150].map(v => ({label: `${v}%`, value: v / 100}));
  private gitApi = inject(GitApiService);
  private gitRefresh = inject(GitRefreshService);
  private popup = inject(PopupService);
  private settingsDialog = viewChild.required(SettingsDialogComponent);
  private cloneDialog = viewChild.required(CloneDialogComponent);
  private shellHistoryDialog = viewChild.required(ShellHistoryDialogComponent);
  private now = toSignal(interval(1000).pipe(map(() => Date.now())), {initialValue: Date.now()});
  protected fetchedAgo = computed(() => {
    const at = this.autoFetchService.lastFetchedAt();
    if (!at) return undefined;
    const secs = Math.floor((this.now()! - at) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  });

  protected push = () => {
    this.loading.set('push');
    this.gitApi.git(['push'])
      .pipe(switchMap(this.gitRefresh.refreshBranchesAndLogs), finalize(() => this.loading.set(undefined)))
      .subscribe(() => {
        this.popup.success('Pushed successfully');
        this.redoAvailable.set(false);
        this.loadReflogState();
      });
  };

  protected pull = () => {
    this.loading.set('pull');
    this.gitApi.git(['pull'])
      .pipe(switchMap(this.gitRefresh.refreshBranchesAndLogs), finalize(() => this.loading.set(undefined)))
      .subscribe(() => {
        this.popup.success('Pulled successfully');
        this.redoAvailable.set(false);
        this.loadReflogState();
      });
  };

  protected fetch = () => {
    this.loading.set('fetch');
    this.gitApi.git(['fetch'])
      .pipe(switchMap(this.gitRefresh.refreshBranchesAndLogs), finalize(() => this.loading.set(undefined)))
      .subscribe(() => {
        this.autoFetchService.lastFetchedAt.set(Date.now());
        this.loadReflogState();
      });
  };

  protected openSettingsDialog = () => this.settingsDialog().open();
  protected openCloneDialog = () => this.cloneDialog().open();
  protected openShellHistoryDialog = () => this.shellHistoryDialog().open();

  ngOnInit() {
    this.loadReflogState();
  }

  private loadReflogState = () =>
    this.gitApi.git(['reflog', '-2', '--format=%gs'])
      .subscribe(output => {
        const lines = output.trim().split('\n');
        const last = lines[0]?.trim() ?? '';
        const prev = lines[1]?.trim() ?? '';
        this.undoTooltip.set(last ? `Undo ${last}` : 'Undo last action');
        this.redoTooltip.set(this.redoAvailable() ? `Redo ${prev}` : 'Nothing to redo');
      });

  protected undo = () => {
    this.gitApi.git(['reset', '--soft', 'HEAD@{1}'])
      .pipe(switchMap(this.gitRefresh.refreshBranchesAndLogs))
      .subscribe(() => { this.popup.success('Undone'); this.redoAvailable.set(true); this.loadReflogState(); });
  };

  protected redo = () =>
    this.gitApi.git(['reset', '--soft', 'HEAD@{1}'])
      .pipe(switchMap(this.gitRefresh.refreshBranchesAndLogs))
      .subscribe(() => { this.popup.success('Redone'); this.redoAvailable.set(false); this.loadReflogState(); });

}
