// Quest 16, the final boss: Lord Reflog. Two agents work at once in their own worktrees, then both join main,
// through a conflict
import { beat, clickMenuItem, jsClick, pressKey, rightClick, see, waitForConflict, waitForMenuItem } from '../../utils/helpers.js';
import { annotate, annotateAt, centerOf, centerOfXPath } from '../../utils/annotations.js';
import {
  branchChip, chipPoint, clickAndWait, commitRow, createFixture, dragBranchChip, type FixtureRepo, markScene, menuItemXPath, openMergeEditor,
  openQuestRepo, openShop, saveMergeResult, setMergeResult,
} from './quest.js';
import { agentRowXPath, closeAgentView, scriptClaude, startWorktreeAgent, waitForAgentDone } from './agents.js';

const fixture = () => createFixture('lord-reflog', openShop);

const FIRE_TITLE = 'Sell fire potions';
const ELF_TITLE = 'Discount for elves';
const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const mergedShop = "export const potions = ['health', 'fire'];\n\nexport const price = (name, buyer) => buyer === 'elf' ? 8 : name === 'fire' ? 20 : 10;\n";

let repo: FixtureRepo;

describe('quest 16 — final boss: Lord Reflog', function () {
  // Longer than mocha's default: the boss fight runs over a minute
  this.timeout(180_000);

  before(async () => {
    scriptClaude([
      {
        match: 'fire',
        name: 'fire-potions',
        title: FIRE_TITLE,
        steps: [
          { delayMs: 2000, say: 'I\'ll add fire potions to the shop.' },
          { delayMs: 4000, files: { 'shop.js': "export const potions = ['health', 'fire'];\n\nexport const price = name => name === 'fire' ? 20 : 10;\n" } },
          { delayMs: 8000, commit: 'feat: sell fire potions' },
          { delayMs: 800, say: 'Done: fire potions sell for 20 gold.' },
        ],
      },
      {
        match: 'elves',
        name: 'elf-discount',
        title: ELF_TITLE,
        steps: [
          { delayMs: 1500, say: 'I\'ll give elves their discount.' },
          { delayMs: 2000, files: { 'shop.js': "export const potions = ['health'];\n\nexport const price = (name, buyer) => buyer === 'elf' ? 8 : 10;\n" } },
          { delayMs: 2000, commit: 'feat: elves pay 8 gold' },
          { delayMs: 800, say: 'Done: elves pay 8 gold.' },
        ],
      },
    ]);
    repo = await openQuestRepo(fixture());
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);

    // The Konami code summons him
    await browser.execute(() => (document.activeElement as HTMLElement | null)?.blur());
    for (const key of KONAMI_CODE) {
      await pressKey(key);
      await beat(60);
    }
    const restButton = await $('.rest-button');
    await restButton.waitForDisplayed({ timeout: 15_000, timeoutMsg: 'Lord Reflog never came' });
    await see(1500);
    await annotate('.rest-button', 'Rest, then face him:\ntwo agents, one history', 'top', 2400);
    await jsClick(restButton);
    await $('.wrath-overlay').waitForExist({ reverse: true, timeout: 5000 });
    await beat(800);

    await startWorktreeAgent('Sell fire potions, 20 gold each', 'Summon a first agent');
    await see(2000);
    await closeAgentView();
    await startWorktreeAgent('Give elves a discount: they pay 8 gold', 'And a second one, at once');
    await see(1800);
    await closeAgentView();
    await annotate('.agents-panel .agents-list', 'Two agents working at once,\neach in its own worktree', 'right', 3000);

    await waitForAgentDone(ELF_TITLE);
    await waitForAgentDone(FIRE_TITLE);
    await beat(600);
    await annotateAt(await centerOfXPath(agentRowXPath(FIRE_TITLE)), 'Both done: their work\nwaits on their branches', 'right', 2800);

    await dragBranchChip('main', 'agent/fire-potions');
    const fastForward = 'Fast-forward main to agent/fire-potions';
    await waitForMenuItem(fastForward);
    await annotateAt(await centerOfXPath(menuItemXPath(fastForward)), 'First: fire potions join main', 'right', 2200);
    await clickAndWait(fastForward, 'Fast-forwarded');
    await beat(1200);

    await rightClick(await $(branchChip('agent/elf-discount')));
    const merge = 'Merge agent/elf-discount into main (1 conflicting file)';
    await waitForMenuItem(merge);
    await beat(500);
    await annotateAt(await centerOfXPath(menuItemXPath(merge)), 'Both agents changed the prices:\na conflict ahead', 'right', 2800);
    await clickMenuItem(merge);

    await $('span.operation-label').waitForDisplayed({ timeout: 20_000, timeoutMsg: 'the merge never stopped on the conflict' });
    await waitForConflict();
    await openMergeEditor();
    await setMergeResult(mergedShop);
    await beat(600);
    await annotate('mis-merge3', 'Keep both: fire at 20,\nelves pay 8', 'top', 2800);
    await saveMergeResult();
    await jsClick(await $('button.operation-continue'));
    await $('span.operation-label').waitForDisplayed({ reverse: true, timeout: 20_000 });
    await commitRow('Merge branch').waitForExist({ timeout: 20_000, timeoutMsg: 'the merge commit never showed' });
    expect(repo.git('show', 'HEAD:shop.js') + '\n').toBe(mergedShop);

    await see(1200);
    await annotateAt(await chipPoint('main'), 'Lord Reflog defeated:\nboth agents\' work, one history', 'right', 3600);
    // The undo button is his: the reflog keeps every step of the fight
    await annotateAt(await centerOf('button:has(i.fa-history)'), 'And should you fall,\nthe reflog remembers', 'bottom', 2800);
    await see(600);
    markScene('end');
  });
});
