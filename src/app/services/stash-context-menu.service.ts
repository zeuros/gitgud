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

import {computed, inject, Injectable, signal} from '@angular/core';
import {type MenuItem} from 'primeng/api';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {GitRefreshService} from './git-refresh.service';
import {PopupService} from './popup.service';
import {switchMap} from 'rxjs';
import {type DisplayRef} from '../lib/github-desktop/model/display-ref';

@Injectable({providedIn: 'root'})
export class StashContextMenuService {

  private gitApi = inject(GitApiService);
  private gitRefresh = inject(GitRefreshService);
  private popup = inject(PopupService);

  selectedCommit = signal<DisplayRef | undefined>(undefined);
  private sha = computed(() => this.selectedCommit()!.sha);

  // Stash index derived from the stash ref name e.g. "stash@{2}"
  private stashRef = computed(() => {
    const ref = this.selectedCommit()?.branchesDetails?.find(b => b.name?.startsWith('stash@'));
    return ref?.name ?? 'stash@{0}';
  });

  stashContextMenu = computed<MenuItem[]>(() => [
    {label: 'Apply stash', icon: 'fa fa-download', command: this.applyStash},
    {label: 'Pop stash', icon: 'fa fa-level-down', command: this.popStash},
    {separator: true},
    {label: 'Drop stash', icon: 'fa fa-trash', command: this.dropStash},
    {separator: true},
    {label: 'Copy stash sha', icon: 'fa fa-copy', command: this.copyCommitSha},
  ]);

  private run = (args: (string | undefined)[], successMsg?: string) =>
    this.gitApi.git(args)
      .pipe(switchMap(this.gitRefresh.refreshAll))
      .subscribe(() => successMsg && this.popup.success(successMsg));

  private stashSummary = computed(() => this.selectedCommit()?.summary ?? this.stashRef());

  private applyStash = () =>
    this.run(['stash', 'apply', this.stashRef()], `Applied stash "${this.stashSummary()}"`);

  private popStash = () =>
    this.run(['stash', 'pop', this.stashRef()], `Popped stash "${this.stashSummary()}"`);

  private dropStash = () =>
    this.run(['stash', 'drop', this.stashRef()], `Dropped stash "${this.stashSummary()}"`);

  private copyCommitSha = () => {
    navigator.clipboard.writeText(this.sha());
    this.popup.success('SHA copied to clipboard');
  };
}
