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
import {first, switchMap} from 'rxjs';
import {type LocalAndDistantTagWithName} from '../utils/tag-utils';
import {GitWorkflowService} from './git-workflow.service';
import {PopupService} from './popup.service';
import {PromptService} from './prompt.service';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {notUndefined} from '../utils/utils';

@Injectable({providedIn: 'root'})
export class TagContextMenuService {

  private gitWorkflow = inject(GitWorkflowService);
  private popup = inject(PopupService);
  private prompt = inject(PromptService);
  private currentRepo = inject(CurrentRepoStore);

  selectedTag = signal<LocalAndDistantTagWithName | undefined>(undefined);
  private name = computed(() => this.selectedTag()?.name);
  private sha = computed(() => this.selectedTag()?.sha);

  tagContextMenu = computed<MenuItem[]>(() => [
    {label: `Push ${this.name()} to origin`, icon: 'fa fa-cloud-upload', command: this.pushTag, visible: !this.selectedTag()?.distant},
    {separator: true},
    {
      label: `Reset ${this.currentRepo.headBranch()?.name ?? 'HEAD'} to ${this.name()}`,
      icon: 'fa fa-history',
      items: [
        {label: 'Soft — keep changes staged', command: () => this.resetToTag('soft')},
        {label: 'Mixed — keep changes in files', command: () => this.resetToTag('mixed')},
        {label: 'Hard — discard changes', command: () => this.resetToTag('hard')},
      ],
    },
    {label: `Checkout commit of ${this.name()}`, icon: 'fa fa-sign-in', command: this.checkoutTag},
    {separator: true},
    {label: `Delete ${this.name()} locally`, icon: 'fa fa-trash', command: this.deleteTag, visible: !!this.selectedTag()?.local},
    {label: `Delete ${this.name()} from origin`, icon: 'fa fa-cloud', command: this.deleteRemoteTag, visible: !!this.selectedTag()?.distant},
    {separator: true},
    {label: 'Copy tag name', icon: 'fa fa-copy', command: this.copyTagName},
    {label: `Annotate ${this.name()}`, icon: 'fa fa-pencil', command: this.annotateTag},
  ]);

  // If right click on local only tag, make sure to push the tag at its current sha so distant tag updates its sha
  private pushTag = () =>
    this.gitWorkflow.doRunAndRefresh(['push', 'origin', '--force', `${this.sha()}:refs/tags/${this.name()}`], `Pushed tag ${this.name()} to origin`);

  private resetToTag = (mode: 'soft' | 'mixed' | 'hard') =>
    this.gitWorkflow.doRunAndRefresh(['reset', `--${mode}`, this.name()], `Reset ${mode} to ${this.name()}`, mode === 'hard', false);

  private checkoutTag = () =>
    this.gitWorkflow.doRunAndRefresh(['checkout', this.sha()], `Checked out ${this.name()} (detached HEAD)`);

  private deleteTag = () =>
    this.gitWorkflow.doRunAndRefresh(['tag', '-d', this.name()], `Deleted tag ${this.name()} locally`);

  private deleteRemoteTag = () =>
    this.gitWorkflow.doRunAndRefresh(['push', 'origin', '--delete', this.name()!], `Deleted tag ${this.name()} from origin`);

  private copyTagName = () =>
    navigator.clipboard.writeText(this.name()!).then(() => this.popup.success('Tag name copied to clipboard'));

  // Converts lightweight tag to annotated, or updates existing annotation message
  private annotateTag = () =>
    this.prompt.open(`Annotation message for ${this.name()}:`).pipe(
      first(notUndefined),
      switchMap(message => this.gitWorkflow.runAndRefresh(
        ['tag', '-f', '-a', this.name(), this.sha(), '-m', message],
        `Annotated tag ${this.name()} updated`,
      )),
    ).subscribe();
}
