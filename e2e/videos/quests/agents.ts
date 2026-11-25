// The agent quests' scripted Claude: record.sh puts fake-claude/claude first on PATH, it plays the tasks written here
import * as fs from 'fs';
import * as path from 'path';
import { beat, jsClick } from '../../utils/helpers.js';
import { annotate } from '../../utils/annotations.js';
import { typeSlowly } from './quest.js';

export interface FakeClaudeStep {
  /** Waited before the step */
  delayMs?: number;
  say?: string;
  /** Written in the agent's worktree, by path */
  files?: Record<string, string>;
  /** Commits everything with this message */
  commit?: string;
}

export interface FakeClaudeTask {
  /** Picks the task whose `match` the prompt holds */
  match: string;
  /** Claude's answer when asked to name the task */
  name: string;
  /** The transcript's title */
  title: string;
  steps: FakeClaudeStep[];
}

/** Gives the fake Claude its tasks, in the config folder record.sh points it to */
export function scriptClaude(tasks: FakeClaudeTask[]): void {
  const configDir = process.env['CLAUDE_CONFIG_DIR'];
  if (!configDir) throw new Error('CLAUDE_CONFIG_DIR is unset: record the agent quests with record.sh');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, 'fake-claude.json'), JSON.stringify(tasks));
}

export const agentRowXPath = (title: string) => `//div[contains(@class,"agent-row")][contains(.,"${title}")]`;

/** Starts a worktree agent from the Agents section's New button, typing `prompt`; resolves once its view shows */
export async function startWorktreeAgent(prompt: string, note?: string): Promise<void> {
  if (note) await annotate('.new-agent button', note, 'right', 2200);
  await jsClick(await $('.new-agent button'));
  const promptInput = await $('gitgud-new-agent-dialog textarea');
  await promptInput.waitForDisplayed({ timeout: 5000 });
  await typeSlowly(promptInput, prompt);
  await beat(500);
  await jsClick(await $('//gitgud-new-agent-dialog//button[normalize-space()="Start"]'));
  await $('.agent-view-dialog .terminal-host').waitForDisplayed({ timeout: 20_000, timeoutMsg: 'the agent\'s terminal never showed' });
}

/** Closes the agent view as a click outside it does */
export async function closeAgentView(): Promise<void> {
  await browser.execute(() => document.querySelector('gitgud-logs')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await $('.agent-view-dialog').waitForDisplayed({ reverse: true, timeout: 5000 });
}

/** Waits until the agent whose transcript has this title waits for the user */
export const waitForAgentDone = (title: string, timeout = 40_000) =>
  $(`${agentRowXPath(title)}[.//span[contains(@class,"status-word")][normalize-space()="needs you"]]`)
    .waitForExist({ timeout, timeoutMsg: `the agent "${title}" never finished` });
