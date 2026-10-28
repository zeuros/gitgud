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

import {ChangeDetectionStrategy, Component, effect, inject, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {map} from 'rxjs';
import {Divider} from 'primeng/divider';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {Textarea} from 'primeng/textarea';
import {ButtonDirective} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {WorkingDirectoryService} from '../../../services/git/working-directory.service';
import {TableModule} from 'primeng/table';
import {type AppFileStatusKind, FileStatusesIcons} from '../../../lib/github-desktop/model/status';
import {ThemeService} from '../../../services/theme.service';
import {directory, fileName} from '../../../utils/utils';
import {FileDiffPanelService} from '../../../services/file-diff-panel.service';
import {CurrentRepoStore} from '../../../stores/current-repo.store';
import {CommitService} from '../../../services/commit.service';
import {FixupService} from '../../../services/fixup.service';
import {headCommit} from '../../../utils/commit-utils';
import type {WorkDirStatus, WorkingDirectoryFileChange} from '../../../lib/github-desktop/model/workdir';
import {Splitter, SplitterPanel} from 'primeng/splitter';
import {WorkingDirFileSelectionService} from '../../../services/working-dir-file-selection.service';
import {GitApiService} from '../../../services/git/git-api.service';

@Component({
  selector: 'gitgud-make-a-commit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Divider,
    ReactiveFormsModule,
    Textarea,
    InputText,
    TableModule,
    ButtonDirective,
    Splitter,
    SplitterPanel,
  ],
  templateUrl: './make-a-commit.component.html',
  styleUrl: './make-a-commit.component.scss',
  standalone: true,
})
export class MakeACommitComponent {

  protected fileDiffPanel = inject(FileDiffPanelService);
  protected workingDirectory = inject(WorkingDirectoryService);
  protected currentRepo = inject(CurrentRepoStore);
  protected workingDirSelection = inject(WorkingDirFileSelectionService);
  protected commitForm = inject(FormBuilder).nonNullable.group({summary: '', description: ''});
  protected amend = signal(false);
  protected summaryLength = toSignal(this.commitForm.controls.summary.valueChanges.pipe(map(summary => summary.length)), {initialValue: 0});
  // Git's conventions for a commit summary: about 50 characters, at most 72
  protected readonly SUMMARY_LENGTH_SHOWN_FROM = 40;
  protected readonly SUMMARY_LENGTH_ADVISED = 50;
  protected readonly SUMMARY_LENGTH_MAX = 72;
  private theme = inject(ThemeService);
  protected FileStatusesIcons = FileStatusesIcons;
  protected keys = Object.keys;

  protected iconDropShadow(kind: AppFileStatusKind): string {
    const alpha = this.theme.isDark() ? '' : '80';
    return `drop-shadow(0 0 5px ${FileStatusesIcons[kind].color}${alpha})`;
  }

  protected directory = directory;
  protected fileName = fileName;
  private commitService = inject(CommitService);
  protected fixup = inject(FixupService);
  private savedFormState?: typeof this.commitForm.value;
  private gitApi = inject(GitApiService);
  private formBeforeOperation?: typeof this.commitForm.value;

  constructor() {
    // An operation stopped on a conflict: we preset summary for it ("Revert …", "Merge branch …")
    effect(() => {
      if (!this.currentRepo.operationInProgress()) {
        if (this.formBeforeOperation) this.commitForm.patchValue(this.formBeforeOperation);
        this.formBeforeOperation = undefined;
        return;
      }
      this.gitApi.gitPath('MERGE_MSG').then(window.tauri.fs.readFile).then(message => {
        // backup commit's summary & description fields to restore after resolving the conflict
        this.formBeforeOperation ??= this.commitForm.value;
        const [summary, ...body] = message.split('\n').filter(line => !line.startsWith('#'));
        this.commitForm.patchValue({summary, description: body.join('\n').trim()});
      }, () => undefined);
    });
  }

  protected commit() {
    const {summary, description} = this.commitForm.value;
    const amend = this.amend();
    this.commitService.commit(summary!, description?.length ? description : undefined, amend)
      .subscribe(() => {
        if (amend) this.toggleAmendMode(false);
      });
  }

  protected toggleAmendMode(amend: boolean) {
    this.amend.set(amend);
    if (amend) {
      // Save current form state
      this.savedFormState = this.commitForm.value;

      // Prefill with last commit message
      const lastCommit = headCommit(this.currentRepo.branches(), this.currentRepo.logs());
      if (lastCommit) this.commitForm.patchValue({summary: lastCommit.summary, description: lastCommit.body ?? ''});
    } else {
      this.restoreBeforeAmendSummary();
    }
  }

  protected commitReady = (workDirStatus?: WorkDirStatus) =>
    !!(this.commitForm.value.summary?.length && workDirStatus?.staged?.length && !workDirStatus.conflicted.length);

  protected $WorkDirFileChanges = (w: WorkingDirectoryFileChange) => w;

  private restoreBeforeAmendSummary = () => {
    if (this.savedFormState) {
      this.commitForm.patchValue(this.savedFormState);
      this.savedFormState = undefined;
    } else
      this.commitForm.reset({summary: '', description: ''});
  };
}
