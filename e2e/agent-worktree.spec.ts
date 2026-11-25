import {type ChildProcess, execSync, spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DEMO_BASE, initRepo, jsClick} from './utils/helpers.js';

describe('Agent in the main worktree', () => {
  let repoDir: string;
  let agent: ChildProcess | undefined;

  before(async () => {
    repoDir = await initRepo(DEMO_BASE);
  });

  after(() => agent?.kill());

  it('offers the agent a worktree, then removes it when the agent ends, keeping the branch', async () => {
    // A process run as `sh …/codex` counts as a codex agent, working while it runs
    const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitgud-fake-agent-'));
    fs.writeFileSync(path.join(agentDir, 'codex'), 'while :; do sleep 1; done\n');
    agent = spawn('sh', [path.join(agentDir, 'codex')], {cwd: repoDir, stdio: 'ignore'});

    await $('//*[contains(@class,"p-dialog-title")][contains(.,"Agent in the main worktree")]')
      .waitForDisplayed({timeout: 20_000, timeoutMsg: 'no dialog offered the agent a worktree'});
    const branchName = await $('#agent-worktree-branch').getValue();
    expect(branchName).toMatch(/^agent\/codex-\d{4}-\d{4}$/);
    expect(await $('.agent-message').getText()).toContain(`commit on ${branchName}`);

    await jsClick(await $('//button[normalize-space()="Create and copy the message"]'));
    const worktreePath = `${repoDir}.worktrees/${branchName}`;
    await browser.waitUntil(() => fs.existsSync(worktreePath), {timeout: 15_000, timeoutMsg: 'the worktree was not created'});
    expect(execSync(`git -C "${repoDir}" worktree list`).toString()).toContain(worktreePath);

    agent.kill();
    const remove = await $('//button[normalize-space()="Remove worktree, keep branch"]');
    await remove.waitForDisplayed({timeout: 20_000, timeoutMsg: 'nothing asked what to do once the agent ended'});
    await jsClick(remove);

    await browser.waitUntil(() => !fs.existsSync(worktreePath), {timeout: 15_000, timeoutMsg: 'the worktree was not removed'});
    expect(execSync(`git -C "${repoDir}" branch --list "${branchName}"`).toString()).toContain(branchName);
  });
});
