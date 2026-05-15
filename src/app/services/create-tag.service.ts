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
import {first, map, switchMap} from 'rxjs';
import {notUndefined} from '../utils/utils';
import {GitWorkflowService} from './git-workflow.service';
import {PromptService} from './prompt.service';

@Injectable({providedIn: 'root'})
export class CreateTagService {

  private prompt = inject(PromptService);
  private gitWorkflow = inject(GitWorkflowService);

  createTag = (sha: string) => this.prompt.open('Tag name:').pipe(
    first(notUndefined),
    switchMap(tagName => this.prompt.open('Tag message for annotated tags (leave empty for lightweight tag):', false)
      .pipe(map(message => ({tagName, message: message ?? null})))),
  ).subscribe(({tagName, message}) =>
    message?.trim()?.length
      ? this.gitWorkflow.doRunAndRefresh(['tag', '-a', tagName, '-m', message, sha], `Annotated tag ${tagName} created`)
      : this.gitWorkflow.doRunAndRefresh(['tag', tagName, sha], `Tag ${tagName} created`));
}
