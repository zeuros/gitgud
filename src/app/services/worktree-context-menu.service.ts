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
import {switchMap} from 'rxjs';
import {GitWorkflowService} from './git-workflow.service';
import {GitRepositoryService} from './git-repository.service';
import {GitRepositoryStore} from '../stores/git-repos.store';
import {createRepository} from '../utils/repository-utils';
import {type GitWorktree} from '../models/git-worktree';

@Injectable({providedIn: 'root'})
export class WorktreeContextMenuService {

  private gitWorkflow = inject(GitWorkflowService);
  private gitRepository = inject(GitRepositoryService);
  private gitRepositoryStore = inject(GitRepositoryStore);

  selectedWorktree = signal<GitWorktree | undefined>(undefined);

  private path = computed(() => this.selectedWorktree()?.path);
  private branch = computed(() => this.selectedWorktree()?.branch);
  private isLocked = computed(() => this.selectedWorktree()?.isLocked ?? false);
  private isMain = computed(() => this.selectedWorktree()?.isMain ?? false);
  private alreadyOpen = computed(() =>
    this.gitRepositoryStore.repositories().some(r => r.id === this.path())
  );

  worktreeContextMenu = computed<MenuItem[]>(() => [
    {
      label: 'Open worktree in new tab',
      icon: 'fa fa-plus-square',
      visible: !this.isMain() && !this.alreadyOpen(),
      command: () => this.openInNewTab(),
    },
    {separator: true, visible: !this.isMain()},
    {
      label: 'Remove this worktree',
      icon: 'fa fa-trash',
      visible: !this.isMain(),
      command: () => this.gitWorkflow.doRunAndRefresh(
        ['worktree', 'remove', this.path()],
        `Removed worktree at ${this.path()}`,
      ),
    },
    {
      label: 'Remove worktree and delete branch',
      icon: 'fa fa-trash',
      visible: !this.isMain() && !!this.branch(),
      command: () => this.removeAndDeleteBranch(),
    },
    {separator: true, visible: !this.isMain()},
    {
      label: this.isLocked() ? 'Unlock this worktree' : 'Lock this worktree',
      icon: this.isLocked() ? 'fa fa-unlock' : 'fa fa-lock',
      visible: !this.isMain(),
      command: () => this.gitWorkflow.doRunAndRefresh(
        ['worktree', this.isLocked() ? 'unlock' : 'lock', this.path()],
        this.isLocked() ? `Unlocked worktree` : `Locked worktree`,
      ),
    },
    {separator: true},
    {
      label: 'Prune worktrees',
      icon: 'fa fa-cut',
      command: () => this.gitWorkflow.doRunAndRefresh(['worktree', 'prune'], 'Pruned stale worktrees'),
    },
  ]);

  private openInNewTab() {
    const path = this.path()!;
    if (!this.gitRepositoryStore.repositories().some(r => r.id === path)) {
      this.gitRepositoryStore.addRepository(createRepository(path));
    }
    // Switch to the new tab
    this.gitRepository.openRepository(path).subscribe();
  }

  private removeAndDeleteBranch() {
    this.gitWorkflow.runAndRefresh(
      ['worktree', 'remove', this.path()],
      undefined,
    ).pipe(
      switchMap(() => this.gitWorkflow.runAndRefresh(
        ['branch', '-d', this.branch()],
        `Removed worktree and deleted branch ${this.branch()}`,
      )),
    ).subscribe();
  }
}
