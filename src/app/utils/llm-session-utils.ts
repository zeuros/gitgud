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

import type {FoundProcess, PtyInfo} from '../../typings';

// An LLM console open in a folder; Claude Code also tells its session's name and whether it works
export interface GitgudClaudeAgent {
  cwd: string;
  sessionId: string;
}

export interface LlmSession {
  tool: string; // 'claude', 'codex', 'gemini'…
  cwd: string;
  pid?: number;
  /** Claude Code's session id, naming its transcript */
  sessionId?: string;
  name?: string;
  isBusy: boolean;
  /** When its transcript last changed, for a session no longer running */
  endedAt?: number;
}

// A CLI often runs as a launcher and its child (node wrapper + native binary): only the launcher is a console.
// The oldest started first, so the order stays as consoles come and go
export const llmConsoles = (processes: FoundProcess[]) =>
  processes
    .filter(({name, parentPid}) => !processes.some(p => p.pid === parentPid && p.name === name))
    .sort((a, b) => a.startTimeSecs - b.startTimeSecs || a.pid - b.pid);

// Claude Code writes <config dir>/sessions/<pid>.json for each running session: its name, and 'busy' while it works
export const parseClaudeStatus = (json: string): Pick<LlmSession, 'sessionId' | 'name' | 'isBusy'> | undefined => {
  try {
    const {sessionId, name, status} = JSON.parse(json) as {sessionId?: unknown; name?: unknown; status?: unknown};
    return {
      sessionId: typeof sessionId === 'string' ? sessionId : undefined,
      name: typeof name === 'string' ? name : undefined,
      isBusy: status === 'busy',
    };
  } catch {
    return undefined;
  }
};

// "claude: fix-it (working)", "claude: fix-it (waiting for you)", "codex", "claude: 11/24/26, 6:02 PM (ended)"
export const llmSessionLabel = ({tool, name, isBusy, endedAt}: LlmSession) => {
  if (endedAt !== undefined)
    return `${tool}: ${name ?? new Date(endedAt).toLocaleString(undefined, {dateStyle: 'short', timeStyle: 'short'})} (ended)`;
  return name === undefined ? tool : `${tool}: ${name} (${isBusy ? 'working' : 'waiting for you'})`;
};

// The same session in two snapshots: its process while it runs, its Claude session after
export const isSameSession = (a: LlmSession, b: LlmSession) =>
  a.pid !== undefined ? a.pid === b.pid : a.sessionId !== undefined && a.sessionId === b.sessionId;

/** The Claude sessions run in GitGud's terminals, to resume when the app starts again */
export const gitgudClaudeAgents = (terminals: PtyInfo[], sessions: LlmSession[]): GitgudClaudeAgent[] =>
  terminals.flatMap(({pid, program, args, cwd}) => {
    if (program !== 'claude') return [];

    const resumedSessionId = args[0] === '--resume' ? args[1] : undefined;
    const sessionId = sessions.find(session => session.pid === pid)?.sessionId ?? resumedSessionId;
    return sessionId ? [{cwd, sessionId}] : [];
  });

const isInside = (path: string, dir: string) => path === dir || path.startsWith(`${dir}/`) || path.startsWith(`${dir}\\`);

/**
 * The sessions open in each worktree, by worktree path. A session belongs to the innermost worktree holding its cwd:
 * linked worktrees often live inside the main worktree (.claude/worktrees/…)
 */
export const llmSessionsByWorktree = (sessions: LlmSession[], worktreePaths: string[]) => {
  const byWorktree = new Map<string, LlmSession[]>();
  for (const session of sessions) {
    const worktree = worktreePaths.filter(p => isInside(session.cwd, p)).sort((a, b) => b.length - a.length)[0];
    if (worktree) byWorktree.set(worktree, [...byWorktree.get(worktree) ?? [], session]);
  }
  return byWorktree;
};
