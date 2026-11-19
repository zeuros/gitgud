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
import type {MenuItem} from 'primeng/api';
import {GitApiService} from './git/git-api.service';
import {GitRefreshService} from './git-refresh.service';
import {ToastService} from './toast.service';
import {finalize} from 'rxjs';
import type {Commit} from '../lib/github-desktop/model/commit';
import {CurrentRepoStore} from '../stores/current-repo.store';

@Injectable({providedIn: 'root'})
export class StashContextMenuService {

  private gitApi = inject(GitApiService);
  private gitRefresh = inject(GitRefreshService);
  private toast = inject(ToastService);
  private currentRepo = inject(CurrentRepoStore);

  selectedStash = signal<Commit | undefined>(undefined);
  private sha = computed(() => this.selectedStash()!.sha);

  // Its position in the stash list, e.g. "stash@{2}"
  private stashRef = computed(() => `stash@{${this.currentRepo.stashes().findIndex(s => s.sha === this.sha())}}`);

  stashContextMenu = computed<MenuItem[]>(() => [
    {label: 'Apply stash', icon: 'fa fa-download', command: this.applyStash},
    {label: 'Pop stash', icon: 'fa fa-level-down', command: this.popStash},
    {separator: true},
    {label: 'Drop stash', icon: 'fa fa-trash', command: this.dropStash},
    {separator: true},
    {label: 'Copy stash sha', icon: 'fa fa-copy', command: this.copyCommitSha},
  ]);

  private run = (args: (string | undefined)[], successMsg?: string) =>
    this.gitApi.gitAction(args)
      .pipe(finalize(this.gitRefresh.doRefreshAll))
      .subscribe(() => successMsg && this.toast.success(successMsg));

  private stashSummary = computed(() => this.selectedStash()?.summary ?? this.stashRef());

  private applyStash = () =>
    this.run(['stash', 'apply', this.stashRef()], `Applied stash "${this.stashSummary()}"`);

  private popStash = () =>
    this.run(['stash', 'pop', this.stashRef()], `Popped stash "${this.stashSummary()}"`);

  private dropStash = () =>
    this.run(['stash', 'drop', this.stashRef()], `Dropped stash "${this.stashSummary()}"`);

  private copyCommitSha = () => {
    navigator.clipboard.writeText(this.sha());
    this.toast.success('SHA copied to clipboard');
  };
}
