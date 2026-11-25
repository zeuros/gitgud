import {describe, expect, it} from 'vitest';
import {agentBranchName, agentTaskName, agentWorktreePath, excludingAgentWorktrees, moveToWorktreeMessage, offeredAgentKeys, runningOfferedAgentKeys, uniqueAgentName} from './agent-worktree-utils';

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

describe('agentTaskName', () => {
  it("takes Claude's answer as a slug", () =>
    expect(agentTaskName('  Fix-Login Redirect.\n', 'whatever')).toBe('fix-login-redirect'));

  it('falls back to the prompt\'s first words', () =>
    expect(agentTaskName('', 'Add dark mode to the settings page please')).toBe('add-dark-mode-to'));

  it('stays short', () =>
    expect(agentTaskName('a'.repeat(30) + ' ' + 'b'.repeat(30), '').length).toBeLessThanOrEqual(40));
});

describe('uniqueAgentName', () => {
  it('appends a number while the name is taken', async () =>
    expect(await uniqueAgentName('fix', async name => ['fix', 'fix-2'].includes(name))).toBe('fix-3'));
});

describe('agent worktrees', () => {
  it('go inside the main worktree, named after the branch', () =>
    expect(agentWorktreePath('/repo', 'agent/fix-login')).toBe('/repo/.claude/worktrees/fix-login'));

  it('are excluded once', () => {
    expect(excludingAgentWorktrees('# git ls-files\n*.log')).toBe('# git ls-files\n*.log\n/.claude/worktrees/\n');
    expect(excludingAgentWorktrees('/.claude/worktrees/\n')).toBeUndefined();
  });
});
