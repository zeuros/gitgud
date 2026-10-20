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

import {inject, Injectable} from '@angular/core';
import {DialogService} from 'primeng/dynamicdialog';
import {filter, switchMap} from 'rxjs';
import {GitWorkflowService} from './git-workflow.service';
import {ToastService} from './toast.service';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {type Commit} from '../lib/github-desktop/model/commit';
import {openSquashDialog} from '../components/dialogs/squash-dialog/squash-dialog.component';
import {squashActions} from '../utils/rebase.utils';

@Injectable({providedIn: 'root'})
export class SquashService {
  private dialog = inject(DialogService);
  private gitWorkflow = inject(GitWorkflowService);
  private currentRepo = inject(CurrentRepoStore);
  private toast = inject(ToastService);

  // Melds `chain` (newest first, see squashableChain) into its oldest commit, with a message the user edits first
  squash = (chain: Commit[]) =>
    openSquashDialog(this.dialog, chain).pipe(
      filter(message => message != null),
      switchMap(message => this.gitWorkflow.rebaseAndEditActions(`${chain.at(-1)!.sha}^`, squashActions(this.currentRepo.cwd()!, chain.map(c => c.sha), message))),
    ).subscribe(() => {
      this.currentRepo.update({selectedCommitsShas: []});
      this.toast.success(`Squashed ${chain.length} commits`);
    });
}
