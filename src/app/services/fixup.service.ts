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

import {inject, Injectable, signal} from '@angular/core';
import {switchMap, tap} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {GitWorkflowService} from './git-workflow.service';
import {PopupService} from './popup.service';
import {type DisplayRef} from '../lib/github-desktop/model/display-ref';
import {short} from '../utils/commit-utils';

@Injectable({providedIn: 'root'})
export class FixupService {
  private gitApi = inject(GitApiService);
  private gitWorkflow = inject(GitWorkflowService);
  private popup = inject(PopupService);

  selectingFixupTarget = signal(false);

  openFixupPicker = () => this.selectingFixupTarget.set(true);

  cancelFixupSelection = () => this.selectingFixupTarget.set(false);

  onCommitSelectedForFixup = (commit: DisplayRef) => {
    this.selectingFixupTarget.set(false);
    this.fixupFromStagedChanges(commit).subscribe();
  };

  fixupFromStagedChanges = (commit: DisplayRef) =>
    this.gitApi.git(['commit', '--fixup', commit.sha]).pipe(
      switchMap(() => this.gitWorkflow.rebaseAndEditActions(`${commit.sha}~1`, a => a, true)),
      tap(() => this.popup.success(`Fixup squashed into ${short(commit.sha)}: ${commit.summary}`)),
    );
}
