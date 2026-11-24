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

import {computed, effect, inject, Injectable, linkedSignal, signal, type Signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {from, interval, startWith, switchMap} from 'rxjs';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {gitgudClaudeAgents, type GitgudClaudeAgent, type LlmSession, llmConsoles, llmSessionsByWorktree, parseClaudeStatus} from '../utils/llm-session-utils';
import {claudeProjectDirName} from '../utils/claude-transcript-utils';
import {ToastService} from './toast.service';
import {AgentTerminalsService} from './agent-terminals.service';

const POLL_MS = 3000;
const SELECTED_LLM_CLI_KEY = 'llm-cli';
// The Claude sessions GitGud runs, resumed when it starts again
const GITGUD_CLAUDE_AGENTS_KEY = 'gitgud-claude-agents';

// LLM CLIs, by the name of their program or script
const LLM_CLIS = ['claude', 'codex', 'gemini', 'qwen', 'aider', 'opencode', 'crush', 'goose', 'cursor-agent', 'copilot', 'amp'];

@Injectable({providedIn: 'root'})
export class LlmSessionsService {

  private currentRepo = inject(CurrentRepoStore);
  private toast = inject(ToastService);
  private agentTerminals = inject(AgentTerminalsService);

  private claudeConfigDir = (() => {
    const env = window.tauri.process.env as Record<string, string | undefined>;
    return env['CLAUDE_CONFIG_DIR'] ?? (env['HOME'] ?? env['USERPROFILE']) + '/.claude';
  })();
  private claudeSessionsDir = `${this.claudeConfigDir}/sessions`;

  private sessions: Signal<LlmSession[]> = toSignal(interval(POLL_MS).pipe(
    startWith(0),
    switchMap(() => from(this.readSessions().catch(() => []))),
  ), {initialValue: []});

  /** The sessions open in each worktree, by worktree path */
  byWorktree = computed(() => llmSessionsByWorktree(this.sessions(), this.currentRepo.worktrees().map(w => w.path)));

  /** The LLM CLIs found on PATH */
  installedClis = toSignal(from(window.tauri.findPrograms(LLM_CLIS).catch((): string[] => [])), {initialValue: []});
  /** The CLI a new agent starts with: the last one started, else Claude */
  selectedCli = linkedSignal(() => {
    const installed = this.installedClis();
    return [localStorage.getItem(SELECTED_LLM_CLI_KEY), 'claude'].find(cli => cli && installed.includes(cli)) ?? installed[0];
  });

  /** The session shown in the agent view */
  openedSession = signal<LlmSession | undefined>(undefined);
  /** The opened session as last seen running: its name and whether it works */
  openedSessionNow = computed(() => {
    const opened = this.openedSession();
    return [...this.byWorktree().values()].flat().find(session => opened?.pid !== undefined && session.pid === opened.pid) ?? opened;
  });

  // Until the agents of the last run are resumed, the saved ones are kept as they are
  private hasResumedAgents = signal(false);

  constructor() {
    this.agentTerminals.restored.then(async ({isAppStart}) => {
      if (isAppStart) await this.resumeAgents();
      this.hasResumedAgents.set(true);
    });
    effect(() => {
      if (!this.hasResumedAgents()) return;
      const agents = gitgudClaudeAgents([...this.agentTerminals.terminals().values()], this.sessions());
      localStorage.setItem(GITGUD_CLAUDE_AGENTS_KEY, JSON.stringify(agents));
    });
    effect(() => {
      const cli = this.selectedCli();
      if (cli) localStorage.setItem(SELECTED_LLM_CLI_KEY, cli);
    });
  }

  /** Runs the selected CLI in the current worktree, in a terminal in GitGud, and shows it */
  startAgent = () => {
    const cwd = this.currentRepo.cwd();
    const cli = this.selectedCli();
    if (!cwd || !cli) return;
    this.agentTerminals.start(cli, [], cwd).then(
      pid => this.openedSession.set({tool: cli, cwd, pid, isBusy: false}),
      (error: unknown) => this.toast.err(`Couldn't start ${cli}: ${error}`),
    );
  };


  // The Claude sessions GitGud ran when it quit, started again in the background
  private resumeAgents = async () => {
    const agents: GitgudClaudeAgent[] = JSON.parse(localStorage.getItem(GITGUD_CLAUDE_AGENTS_KEY) ?? '[]');
    await Promise.all(agents.map(async ({cwd, sessionId}) => {
      if (!await window.tauri.fs.exists(cwd).catch(() => false)) return;
      await this.agentTerminals.start('claude', ['--resume', sessionId], cwd)
        .catch((error: unknown) => this.toast.err(`Couldn't resume the agent in ${cwd}: ${error}`));
    }));
  };

  /** Whether GitGud runs the session, in a terminal it shows, rather than another terminal */
  isRunInGitgud = ({pid}: LlmSession) => pid !== undefined && this.agentTerminals.terminals().has(pid);

  /** Claude Code's transcript of the session, undefined for other CLIs */
  transcriptPath = ({cwd, sessionId}: LlmSession) =>
    sessionId ? `${this.claudeConfigDir}/projects/${claudeProjectDirName(cwd)}/${sessionId}.jsonl` : undefined;

  private async readSessions() {
    const consoles = llmConsoles(await window.tauri.findProcesses(LLM_CLIS));
    return Promise.all(consoles.map(async ({pid, name, cwd}): Promise<LlmSession> =>
      ({tool: name, cwd, pid, isBusy: false, ...name === 'claude' ? await this.readClaudeStatus(pid) : undefined})));
  }

  private readClaudeStatus(pid: number) {
    return window.tauri.fs.readFile(`${this.claudeSessionsDir}/${pid}.json`).then(parseClaudeStatus, () => undefined);
  }
}
