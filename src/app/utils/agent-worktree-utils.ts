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

import type {LlmSession} from './llm-session-utils';

/** A linked worktree GitGud created for an agent found in the main worktree, asked about when the agent ends */
export interface TemporaryWorktree {
  repoId: string;
  pid: number;
  tool: string;
  worktreePath: string;
  branchName: string;
}

/** What tells an agent apart across GitGud's restarts: its pid, and Claude's session id once read */
export const offeredAgentKeys = ({sessionId, pid}: LlmSession) => [`pid:${pid}`, ...sessionId ? [sessionId] : []];

/** The offered agents' keys still running: the others are dropped, a pid being reused later */
export const runningOfferedAgentKeys = (offeredKeys: string[], running: LlmSession[]) => {
  const runningKeys = new Set(running.flatMap(offeredAgentKeys));
  return offeredKeys.filter(key => runningKeys.has(key));
};

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const twoDigits = (value: number) => String(value).padStart(2, '0');

/** A new branch for the agent: its session's name or its CLI, then the time, e.g. agent/fix-login-1124-2005 */
export const agentBranchName = ({tool, name}: LlmSession, now: Date) => {
  const time = `${twoDigits(now.getMonth() + 1)}${twoDigits(now.getDate())}-${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}`;
  return `agent/${slug(name ?? tool) || tool}-${time}`;
};

const MAX_TASK_NAME_LENGTH = 40;
const FALLBACK_TASK_NAME_WORDS = 4;

/** What Claude is asked to name a task by, before the prompt */
export const TASK_NAMING_PROMPT = 'Reply with only a 2 to 4 word kebab-case name for this coding task, for a git branch, nothing else. The task:\n\n';

/** A worktree and branch name for the task: Claude's answer as a slug, else the prompt's first words */
export const agentTaskName = (answer: string, prompt: string) => {
  const cut = (name: string) => name.slice(0, MAX_TASK_NAME_LENGTH).replace(/-$/, '');
  return cut(slug(answer.trim().split('\n').at(-1) ?? ''))
    || cut(slug(prompt.split(/\s+/).slice(0, FALLBACK_TASK_NAME_WORDS).join(' ')))
    || 'task';
};

/** `name`, or `name-2`, `name-3`… if taken */
export const uniqueAgentName = async (name: string, isTaken: (name: string) => boolean | Promise<boolean>) => {
  let unique = name;
  for (let suffix = 2; await isTaken(unique); suffix++) unique = `${name}-${suffix}`;
  return unique;
};

/** Where an agent's worktree goes: inside the main worktree, where Claude Code puts its own, so Claude's shell may
 * work there (it resets to its working folder when a command leaves it) */
export const AGENT_WORKTREES_DIR = '.claude/worktrees';
export const agentWorktreePath = (mainWorktreePath: string, branchName: string) =>
  `${mainWorktreePath}/${AGENT_WORKTREES_DIR}/${branchName.replace(/^agent\//, '').replaceAll('/', '-')}`;

/** The exclude file's text with the agents' worktrees in it, undefined when it already has them */
export const excludingAgentWorktrees = (exclude: string) => {
  const line = `/${AGENT_WORKTREES_DIR}/`;
  if (exclude.split('\n').some(existing => existing.trim() === line)) return undefined;
  return `${exclude}${exclude && !exclude.endsWith('\n') ? '\n' : ''}${line}\n`;
};

/** What GitGud tells the agent to move it to its linked worktree */
export const moveToWorktreeMessage = (worktreePath: string, branchName: string, mainWorktreePath: string) =>
  `GitGud created the linked worktree ${worktreePath} on the new branch ${branchName}, from HEAD. `
  + `Work there from now on: run your commands in it, edit its files and commit on ${branchName}. Leave ${mainWorktreePath} as it is.`;
