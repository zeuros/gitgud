import {describe, expect, it} from 'vitest';
import {agentBranchName, moveToWorktreeMessage, offeredAgentKeys, runningOfferedAgentKeys} from './agent-worktree-utils';

describe('agentBranchName', () => {
  const now = new Date(2026, 10, 24, 20, 5);

  it('names the branch after the session, then the time', () =>
    expect(agentBranchName({tool: 'claude', cwd: '/repo', name: 'Fix the login!', isBusy: true}, now)).toBe('agent/fix-the-login-1124-2005'));

  it('falls back to the CLI without a session name', () =>
    expect(agentBranchName({tool: 'codex', cwd: '/repo', isBusy: false}, now)).toBe('agent/codex-1124-2005'));

  it('falls back to the CLI when the name has no letter or digit', () =>
    expect(agentBranchName({tool: 'claude', cwd: '/repo', name: '…', isBusy: false}, now)).toBe('agent/claude-1124-2005'));
});

describe('moveToWorktreeMessage', () => {
  it('names the worktree, its branch and the main worktree to leave', () => {
    const message = moveToWorktreeMessage('/repo.worktrees/agent/x', 'agent/x', '/repo');
    expect(message).toContain('/repo.worktrees/agent/x');
    expect(message).toContain('commit on agent/x');
    expect(message).toContain('Leave /repo as it is');
  });
});

describe('offered agents', () => {
  const claude = {tool: 'claude', cwd: '/repo', pid: 10, sessionId: 'abc', isBusy: true};
  const codex = {tool: 'codex', cwd: '/repo', pid: 20, isBusy: false};

  it('keys an agent by its pid, and Claude by its session id too', () => {
    expect(offeredAgentKeys(claude)).toEqual(['pid:10', 'abc']);
    expect(offeredAgentKeys(codex)).toEqual(['pid:20']);
  });

  it('keeps the keys of the agents still running', () =>
    expect(runningOfferedAgentKeys(['pid:10', 'abc', 'pid:20', 'gone'], [claude])).toEqual(['pid:10', 'abc']));
});
