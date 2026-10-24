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

import {computed, inject, Injectable} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {from, interval, startWith, switchMap} from 'rxjs';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {type LlmSession, llmConsoles, llmSessionsByWorktree, parseClaudeStatus} from '../utils/llm-session-utils';

const POLL_MS = 3000;

// LLM CLIs, by the name of their program or script
const LLM_CLIS = ['claude', 'codex', 'gemini', 'qwen', 'aider', 'opencode', 'crush', 'goose', 'cursor-agent', 'copilot', 'amp'];

/** The LLM consoles open in the current repository's worktrees */
@Injectable({providedIn: 'root'})
export class LlmSessionsService {

  private currentRepo = inject(CurrentRepoStore);

  private claudeSessionsDir = (() => {
    const env = window.tauri.process.env as Record<string, string | undefined>;
    const configDir = env['CLAUDE_CONFIG_DIR'] ?? (env['HOME'] ?? env['USERPROFILE']) + '/.claude';
    return `${configDir}/sessions`;
  })();

  private sessions = toSignal(interval(POLL_MS).pipe(
    startWith(0),
    switchMap(() => from(this.readSessions().catch(() => []))),
  ), {initialValue: [] as LlmSession[]});

  /** The sessions open in each worktree, by worktree path */
  byWorktree = computed(() => llmSessionsByWorktree(this.sessions(), this.currentRepo.worktrees().map(w => w.path)));

  private async readSessions() {
    const consoles = llmConsoles(await window.tauri.findProcesses(LLM_CLIS));
    return Promise.all(consoles.map(async ({pid, name, cwd}): Promise<LlmSession> =>
      ({tool: name, cwd, isBusy: false, ...name === 'claude' ? await this.readClaudeStatus(pid) : undefined})));
  }

  private readClaudeStatus(pid: number) {
    return window.tauri.fs.readFile(`${this.claudeSessionsDir}/${pid}.json`).then(parseClaudeStatus, () => undefined);
  }
}
