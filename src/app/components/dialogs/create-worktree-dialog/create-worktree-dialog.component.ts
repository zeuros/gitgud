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
import {Select} from 'primeng/select';
import {PrimeTemplate} from 'primeng/api';
import {CurrentRepoStore} from '../../../stores/current-repo.store';
import {GitWorkflowService} from '../../../services/git-workflow.service';
import {BranchType} from '../../../lib/github-desktop/model/branch';
import {finalize} from 'rxjs';
import {DynamicDialogRef} from 'primeng/dynamicdialog';

interface BranchOption {
  label: string;
  value: string;
  isRemote: boolean;
}

@Component({
  selector: 'gitgud-create-worktree-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Button, InputText, Select, FormsModule, PrimeTemplate],
  templateUrl: './create-worktree-dialog.component.html',
  styleUrl: './create-worktree-dialog.component.scss',
})
export class CreateWorktreeDialogComponent {

  private currentRepo = inject(CurrentRepoStore);
  private gitWorkflow = inject(GitWorkflowService);
  protected ref = inject(DynamicDialogRef);

  protected reference = signal<BranchOption | null>(null);
  protected newBranch = signal('');
  protected workDir = signal('');
  protected loading = signal(false);

  protected branchOptions = computed<BranchOption[]>(() =>
    this.currentRepo.branches().map(b => ({
      label: b.name,
      value: b.name,
      isRemote: b.type === BranchType.Remote,
    }))
  );

  protected onReferenceSelect(opt: BranchOption | null) {
    this.reference.set(opt);
    if (!opt) return;
    const branchName = opt.label.replace(/^origin\//, '');
    this.newBranch.set(branchName);
    this.refreshWorkDir(branchName);
  }

  protected onNewBranchInput(name: string) {
    this.newBranch.set(name);
    if (name) this.refreshWorkDir(name);
  }

  private refreshWorkDir(branchName: string) {
    const cwd = this.currentRepo.cwd() ?? '';
    this.workDir.set(`${cwd}.worktrees/${branchName}`);
  }

  protected browse() {
    window.tauri.dialog.showOpenDialog({properties: ['openDirectory']}).then(picked => {
      if (picked?.[0]) this.workDir.set(picked[0]);
    });
  }

  protected canSubmit = computed(() =>
    !!this.reference() && !!this.newBranch().trim() && !!this.workDir().trim()
  );

  protected create() {
    if (!this.canSubmit()) return;
    const path = this.workDir().trim();
    const branch = this.newBranch().trim();
    const ref = this.reference()!.value;

    // If the target branch already exists locally, check it out directly.
    // Using -b on an existing branch causes git to exit with an error.
    const branchAlreadyExists = this.currentRepo.branches()
      .some(b => b.type === BranchType.Local && b.name === branch);

    const args = branchAlreadyExists
      ? ['worktree', 'add', path, branch]
      : ['worktree', 'add', '-b', branch, path, ref];

    this.loading.set(true);
    this.gitWorkflow.runAndRefresh(args, `Worktree created at ${path}`)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(() => this.ref.close());
  }
}
