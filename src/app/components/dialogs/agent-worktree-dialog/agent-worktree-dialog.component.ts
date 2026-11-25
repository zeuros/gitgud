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
import {ButtonDirective} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {type DialogService, DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import type {Observable} from 'rxjs';
import {type LlmSession, llmSessionLabel} from '../../../utils/llm-session-utils';
import {agentWorktreePath, moveToWorktreeMessage} from '../../../utils/agent-worktree-utils';

export interface AgentWorktreeDialogData {
  session: LlmSession;
  mainWorktreePath: string;
  branchName: string;
  isRunInGitgud: boolean;
}

export interface AgentWorktree {
  worktreePath: string;
  branchName: string;
  message: string;
}

export const openAgentWorktreeDialog = (dialog: DialogService, data: AgentWorktreeDialogData): Observable<AgentWorktree | undefined> =>
  dialog.open(AgentWorktreeDialogComponent, {header: 'Agent in the main worktree', width: '560px', data})!.onClose;

@Component({
  selector: 'gitgud-agent-worktree-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, ButtonDirective, InputText],
  template: `
    <div class="flex flex-column gap-3 pt-2">
      <span>
        <strong>{{ agentLabel }}</strong> is working in the main worktree, {{ data.mainWorktreePath }}.
        Give it a linked worktree on a new branch, from HEAD?
      </span>
      <div class="field">
        <label for="agent-worktree-branch">Branch</label>
        <input id="agent-worktree-branch" pInputText class="w-full" [ngModel]="branchName()" (ngModelChange)="onBranchNameInput($event)"/>
      </div>
      <div class="field">
        <label for="agent-worktree-path">Worktree path</label>
        <input id="agent-worktree-path" pInputText class="w-full" [ngModel]="worktreePath()" (ngModelChange)="worktreePath.set($event)"/>
      </div>
      <span class="text-gray">
        Uncommitted changes stay in the main worktree.
        @if (data.isRunInGitgud) {
          GitGud types this into the agent:
        } @else {
          GitGud copies this, to paste into the agent:
        }
      </span>
      <div class="agent-message">{{ message() }}</div>
      <div class="flex gap-2 justify-content-end">
        <button pButton text severity="secondary" (click)="ref.close(undefined)">Keep the main worktree</button>
        <button pButton (click)="create()" [disabled]="!branchName().trim() || !worktreePath().trim()">
          {{ data.isRunInGitgud ? 'Create and tell the agent' : 'Create and copy the message' }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .agent-message {
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      background: var(--p-content-hover-background);
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.8rem;
      white-space: pre-wrap;
    }
  `,
})
export class AgentWorktreeDialogComponent {

  protected ref = inject(DynamicDialogRef<AgentWorktree | undefined>);
  protected data: AgentWorktreeDialogData = inject(DynamicDialogConfig).data;

  protected branchName = signal(this.data.branchName);
  protected worktreePath = signal(agentWorktreePath(this.data.mainWorktreePath, this.data.branchName));

  protected agentLabel = llmSessionLabel(this.data.session);
  protected message = computed(() => moveToWorktreeMessage(this.worktreePath().trim(), this.branchName().trim(), this.data.mainWorktreePath));

  // The path follows the branch name
  protected onBranchNameInput(branchName: string) {
    this.branchName.set(branchName);
    this.worktreePath.set(agentWorktreePath(this.data.mainWorktreePath, branchName.trim()));
  }

  protected create() {
    this.ref.close({worktreePath: this.worktreePath().trim(), branchName: this.branchName().trim(), message: this.message()} satisfies AgentWorktree);
  }
}
