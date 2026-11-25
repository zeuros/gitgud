// Quest 15: Claude works on a task in a linked worktree and branch of its own, while main stays untouched
import { beat, see } from '../../utils/helpers.js';
import { annotate, annotateAt, centerOfXPath } from '../../utils/annotations.js';
import { chipPoint, commitRowXPath, createFixture, type FixtureRepo, markScene, openQuestRepo, openShop } from './quest.js';
import { agentRowXPath, closeAgentView, scriptClaude, startWorktreeAgent, waitForAgentDone } from './agents.js';

const fixture = () => createFixture('worktree-agent', openShop);

const TITLE = 'Sell fire potions';

let repo: FixtureRepo;

describe('quest 15 — agent in its own worktree', function () {
  this.timeout(120_000);

  before(async () => {
    scriptClaude([{
      match: 'fire',
      name: 'fire-potions',
      title: TITLE,
      steps: [
        { delayMs: 1500, say: 'I\'ll add fire potions to the shop.' },
        { delayMs: 1500, files: { 'shop.js': "export const potions = ['health', 'fire'];\n\nexport const price = name => name === 'fire' ? 20 : 10;\n" } },
        { delayMs: 1500, commit: 'feat: sell fire potions' },
        { delayMs: 800, say: 'Done: fire potions sell for 20 gold, committed on agent/fire-potions.' },
      ],
    }]);
    repo = await openQuestRepo(fixture());
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);
    await annotate('.agents-panel .title', 'Agents: the AI coding CLIs\nrunning in this repository', 'right', 2600);

    await startWorktreeAgent('Sell fire potions, 20 gold each', 'New: Claude on a task,\nin a worktree of its own');
    await beat(1500);
    await annotate('.agent-view-dialog .p-dialog-header', 'A new linked worktree and branch,\nnamed after the task', 'bottom', 3000);
    await browser.waitUntil(async () => repo.git('log', '-1', '--format=%s', 'agent/fire-potions') === 'feat: sell fire potions',
      { timeout: 30_000, timeoutMsg: 'the agent never committed' });
    await see(2000);
    await closeAgentView();

    await waitForAgentDone(TITLE);
    await beat(600);
    await annotateAt(await centerOfXPath(agentRowXPath(TITLE)), 'Done: it waits for you', 'right', 2400);
    await annotateAt(await centerOfXPath('//div[contains(@class,"agent-worktree")][contains(.,"agent/fire-potions")]'), 'Its worktree, on agent/fire-potions', 'right', 2400);
    await annotateAt(await centerOfXPath(commitRowXPath('sell fire potions')), 'Its commit, on its own branch:\nreview it, then merge', 'right', 3000);
    expect(repo.git('status', '--porcelain')).toBe('');
    await annotateAt(await chipPoint('main'), 'main and your files: untouched', 'right', 2800);
    await see(600);
    markScene('end');
  });
});
