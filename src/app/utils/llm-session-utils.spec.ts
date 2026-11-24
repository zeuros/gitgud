import {describe, expect, it} from 'vitest';
import type {FoundProcess} from '../../typings';
import {gitgudClaudeAgents, type LlmSession, llmConsoles, llmSessionLabel, llmSessionsByWorktree, parseClaudeStatus} from './llm-session-utils';

describe('llmConsoles', () => {
  const process = (pid: number, parentPid: number | null, name: string): FoundProcess => ({pid, parentPid, name, cwd: '/repo', startTimeSecs: 0});

  it('keeps a launcher, not its child of the same CLI, and each console of a folder', () =>
    expect(llmConsoles([
      process(10, 1, 'codex'), process(11, 10, 'codex'),
      process(20, 2, 'claude'), process(30, 3, 'claude'),
    ]).map(p => p.pid)).toEqual([10, 20, 30]));
});

describe('llmConsoles order', () => {
  it('lists the oldest started first, then by pid', () => {
    const consoles = llmConsoles([
      {pid: 30, parentPid: 1, name: 'codex', cwd: '/repo', startTimeSecs: 200},
      {pid: 20, parentPid: 1, name: 'claude', cwd: '/repo', startTimeSecs: 100},
      {pid: 10, parentPid: 1, name: 'claude', cwd: '/repo', startTimeSecs: 200},
    ]);
    expect(consoles.map(c => c.pid)).toEqual([20, 10, 30]);
  });
});

describe('parseClaudeStatus', () => {
  it('reads the session id, the name and whether it works', () => {
    expect(parseClaudeStatus('{"pid":12,"sessionId":"abc","cwd":"/repo","name":"fix-it","status":"busy"}')).toEqual({sessionId: 'abc', name: 'fix-it', isBusy: true});
    expect(parseClaudeStatus('{"status":"idle"}')).toEqual({sessionId: undefined, name: undefined, isBusy: false});
  });
  it('is undefined for a broken file', () => expect(parseClaudeStatus('{"pid":1')).toBeUndefined());
});

describe('llmSessionLabel', () => {
  it('names a session and says whether it works', () => {
    expect(llmSessionLabel({tool: 'claude', cwd: '/repo', name: 'fix-it', isBusy: true})).toBe('claude: fix-it (working)');
    expect(llmSessionLabel({tool: 'claude', cwd: '/repo', name: 'fix-it', isBusy: false})).toBe('claude: fix-it (waiting for you)');
  });
  it('is the tool for a console without a session name', () => expect(llmSessionLabel({tool: 'codex', cwd: '/repo', isBusy: false})).toBe('codex'));
});

describe('llmSessionsByWorktree', () => {
  const session = (cwd: string, tool = 'claude'): LlmSession => ({tool, cwd, isBusy: false});
  const worktrees = ['/repo', '/repo/.claude/worktrees/feature', '/elsewhere/hotfix'];

  it('puts each session in the innermost worktree holding its cwd', () => {
    const byWorktree = llmSessionsByWorktree([
      session('/repo/.claude/worktrees/feature'),
      session('/repo/src', 'codex'),
      session('/elsewhere/hotfix', 'gemini'),
    ], worktrees);
    expect(Object.fromEntries([...byWorktree].map(([path, sessions]) => [path, sessions.map(s => s.tool)])))
      .toEqual({'/repo/.claude/worktrees/feature': ['claude'], '/repo': ['codex'], '/elsewhere/hotfix': ['gemini']});
  });

  it('skips the sessions outside the worktrees', () =>
    expect(llmSessionsByWorktree([session('/repository')], worktrees).size).toBe(0));
});

describe('gitgudClaudeAgents', () => {
  it('keeps the Claude terminals with a session id: the running one, else the one resumed', () =>
    expect(gitgudClaudeAgents([
      {pid: 1, program: 'claude', args: [], cwd: '/a'},
      {pid: 2, program: 'claude', args: ['--resume', 'old'], cwd: '/b'},
      {pid: 3, program: 'claude', args: [], cwd: '/c'},
      {pid: 4, program: 'codex', args: [], cwd: '/d'},
    ], [
      {tool: 'claude', cwd: '/a', pid: 1, sessionId: 's1', isBusy: false},
      {tool: 'codex', cwd: '/d', pid: 4, isBusy: false},
    ])).toEqual([{cwd: '/a', sessionId: 's1'}, {cwd: '/b', sessionId: 'old'}]));
});
