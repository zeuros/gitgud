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

import {computed, effect, inject, Injectable, signal, untracked} from '@angular/core';
import {ConfirmationService} from 'primeng/api';
import {DialogService} from 'primeng/dynamicdialog';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {LlmSessionsService} from './llm-sessions.service';
import {GitWorkflowService} from './git-workflow.service';
import {WorktreeContextMenuService} from './worktree-context-menu.service';
import {ToastService} from './toast.service';
import type {LlmSession} from '../utils/llm-session-utils';
import {withoutTrailingSlash} from '../utils/worktree-utils';
import {agentBranchName, offeredAgentKeys, runningOfferedAgentKeys, type TemporaryWorktree} from '../utils/agent-worktree-utils';
import {type AgentWorktree, openAgentWorktreeDialog} from '../components/dialogs/agent-worktree-dialog/agent-worktree-dialog.component';

const TEMPORARY_WORKTREES_KEY = 'agent-temporary-worktrees';
const OFFERED_AGENTS_KEY = 'agent-offered-sessions';
// Lets the agent's input take the message before Enter sends it
const ENTER_DELAY_MS = 200;

/**
 * Offers an agent found working in the main worktree a linked worktree of its own, and tells it to move there.
 * When that agent ends, asks whether to keep the worktree or remove it, keeping its branch.
 */
@Injectable({providedIn: 'root'})
export class AgentWorktreeService {

  private currentRepo = inject(CurrentRepoStore);
  private llmSessions = inject(LlmSessionsService);
  private gitWorkflow = inject(GitWorkflowService);
  private worktreeContextMenu = inject(WorktreeContextMenuService);
  private dialog = inject(DialogService);
  private confirmation = inject(ConfirmationService);
  private toast = inject(ToastService);

  // Agents in the main worktree already offered a worktree, by offeredAgentKeys: kept across restarts and reloads
  private offeredAgentKeys = signal<string[]>(JSON.parse(localStorage.getItem(OFFERED_AGENTS_KEY) ?? '[]'));
  private isAsking = signal(false);
  private temporaryWorktrees = signal<TemporaryWorktree[]>(JSON.parse(localStorage.getItem(TEMPORARY_WORKTREES_KEY) ?? '[]'));

  private mainWorktreePath = computed(() => this.currentRepo.worktrees().find(worktree => worktree.isMain)?.path);
  // Claude Code tells whether it works; other CLIs count as working while they run
  private agentWorkingInMainWorktree = computed(() => {
    const mainWorktreePath = this.mainWorktreePath();
    const offeredKeys = new Set(this.offeredAgentKeys());
    const temporaryWorktreePids = new Set(this.temporaryWorktrees().map(temporaryWorktree => temporaryWorktree.pid));
    return (mainWorktreePath ? this.llmSessions.byWorktree().get(mainWorktreePath) ?? [] : [])
      .find(session => session.pid !== undefined && !offeredAgentKeys(session).some(key => offeredKeys.has(key)) && !temporaryWorktreePids.has(session.pid)
        && (session.tool !== 'claude' || session.isBusy));
  });
  private currentRepoTemporaryWorktrees = computed(() => {
    const repoId = this.currentRepo.id();
    return this.temporaryWorktrees().filter(temporaryWorktree => temporaryWorktree.repoId === repoId);
  });
  private endedAgentWorktree = computed(() => {
    if (!this.llmSessions.hasReadSessions()) return undefined;
    const runningPids = new Set(this.llmSessions.sessions().map(session => session.pid));
    return this.currentRepoTemporaryWorktrees().find(temporaryWorktree => !runningPids.has(temporaryWorktree.pid));
  });

  constructor() {
    effect(() => localStorage.setItem(TEMPORARY_WORKTREES_KEY, JSON.stringify(this.temporaryWorktrees())));
    effect(() => localStorage.setItem(OFFERED_AGENTS_KEY, JSON.stringify(this.offeredAgentKeys())));
    // Forgets the agents that ended
    effect(() => {
      if (!this.llmSessions.hasReadSessions()) return;
      const running = this.llmSessions.sessions();
      untracked(() => this.offeredAgentKeys.update(keys => {
        const runningKeys = runningOfferedAgentKeys(keys, running);
        return runningKeys.length === keys.length ? keys : runningKeys;
      }));
    });

    effect(() => {
      const session = this.agentWorkingInMainWorktree();
      if (session && !this.isAsking()) untracked(() => this.offerWorktree(session));
    });

    effect(() => {
      const temporaryWorktree = this.endedAgentWorktree();
      if (temporaryWorktree && !this.isAsking()) untracked(() => this.askAfterAgentEnded(temporaryWorktree));
    });
  }

  private offerWorktree(session: LlmSession) {
    const mainWorktreePath = this.mainWorktreePath();
    const repoId = this.currentRepo.id();
    if (!mainWorktreePath || !repoId || session.pid === undefined) return;
    const pid = session.pid;

    this.offeredAgentKeys.update(keys => [...keys, ...offeredAgentKeys(session)]);
    this.isAsking.set(true);
    openAgentWorktreeDialog(this.dialog, {
      session,
      mainWorktreePath,
      branchName: agentBranchName(session, new Date()),
      isRunInGitgud: this.llmSessions.isRunInGitgud(session),
    }).subscribe(agentWorktree => {
      this.isAsking.set(false);
      if (agentWorktree) this.createAndTell(session, pid, repoId, agentWorktree);
    });
  }

  private createAndTell(session: LlmSession, pid: number, repoId: string, {worktreePath, branchName, message}: AgentWorktree) {
    this.gitWorkflow.runAndRefresh(['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'], `Worktree created at ${worktreePath}`)
      .subscribe(() => {
        this.temporaryWorktrees.update(temporaryWorktrees => [...temporaryWorktrees, {repoId, pid, tool: session.tool, worktreePath, branchName}]);
        this.tell(session, pid, message);
      });
  }

  private tell(session: LlmSession, pid: number, message: string) {
    if (!this.llmSessions.isRunInGitgud(session)) {
      navigator.clipboard.writeText(message).then(
        () => this.toast.info(`Message copied: paste it into ${session.tool}`),
        () => this.toast.warn(`Couldn't copy the message, tell ${session.tool}: ${message}`),
      );
      return;
    }

    window.tauri.pty.write(pid, message)
      .then(() => new Promise(resolve => setTimeout(resolve, ENTER_DELAY_MS)))
      .then(() => window.tauri.pty.write(pid, '\r'))
      .catch((error: unknown) => this.toast.err(`Couldn't tell ${session.tool} to move: ${error}`));
  }

  // Skips a worktree removed meanwhile. Closing the dialog keeps the worktree, as "Keep going" does
  private askAfterAgentEnded(temporaryWorktree: TemporaryWorktree) {
    const {tool, worktreePath, branchName} = temporaryWorktree;
    if (!this.currentRepo.worktrees().some(worktree => worktree.path === withoutTrailingSlash(worktreePath))) {
      this.forget(temporaryWorktree);
      return;
    }

    this.isAsking.set(true);
    this.confirmation.confirm({
      header: 'Agent ended',
      message: `${tool} ended. Its worktree ${worktreePath}, on ${branchName}: remove it and keep the branch, or keep going there?`,
      acceptLabel: 'Remove worktree, keep branch',
      rejectLabel: 'Keep going',
      rejectButtonStyleClass: 'p-button-secondary p-button-text',
      defaultFocus: 'accept',
      accept: () => {
        this.forget(temporaryWorktree);
        this.isAsking.set(false);
        this.worktreeContextMenu.removeWorktree(worktreePath, `Removed worktree at ${worktreePath}, kept ${branchName}`).subscribe();
      },
      reject: () => {
        this.forget(temporaryWorktree);
        this.isAsking.set(false);
      },
    });
  }

  private forget(...forgotten: TemporaryWorktree[]) {
    this.temporaryWorktrees.update(temporaryWorktrees => temporaryWorktrees.filter(temporaryWorktree => !forgotten.includes(temporaryWorktree)));
  }
}
