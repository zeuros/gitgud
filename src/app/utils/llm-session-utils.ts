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

import type {FoundProcess} from '../../typings';

// An LLM console open in a folder; Claude Code also tells its session's name and whether it works
export interface LlmSession {
  tool: string; // 'claude', 'codex', 'gemini'…
  cwd: string;
  name?: string;
  isBusy: boolean;
}

// A CLI often runs as a launcher and its child (node wrapper + native binary): only the launcher is a console
export const llmConsoles = (processes: FoundProcess[]) =>
  processes.filter(({name, parentPid}) => !processes.some(p => p.pid === parentPid && p.name === name));

// Claude Code writes <config dir>/sessions/<pid>.json for each running session: its name, and 'busy' while it works
export const parseClaudeStatus = (json: string): Pick<LlmSession, 'name' | 'isBusy'> | undefined => {
  try {
    const {name, status} = JSON.parse(json) as {name?: unknown; status?: unknown};
    return {name: typeof name === 'string' ? name : undefined, isBusy: status === 'busy'};
  } catch {
    return undefined;
  }
};

// "claude: fix-it (working)", "claude: fix-it (waiting for you)", "codex"
export const llmSessionLabel = ({tool, name, isBusy}: LlmSession) =>
  name === undefined ? tool : `${tool}: ${name} (${isBusy ? 'working' : 'waiting for you'})`;

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
