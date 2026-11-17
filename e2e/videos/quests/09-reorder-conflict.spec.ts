// Quest 9: move a commit below the one it builds on: each replayed commit stops on a conflict
//
//   feat: sell fire potions      potions.txt = health, mana, fire   ← moved down
//   feat: sell mana potions      potions.txt = health, mana
//   chore: open the potion shop  potions.txt = health
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { beat, byText, jsClick, see, waitForConflict, waitForMerge } from '../../utils/helpers.js';
import { annotate, annotateAt, centerOfXPath } from '../../utils/annotations.js';
import { commitMenu, commitRowXPath, createFixture, markScene, openQuestRepo } from './quest.js';

const fixture = () => createFixture('reorder-conflict', repo => {
  repo.commit('chore: open the potion shop', { 'potions.txt': 'health\n', 'README.md': '# Potion shop\n' });
  repo.commit('feat: sell mana potions', { 'potions.txt': 'health\nmana\n' });
  repo.commit('feat: sell fire potions', { 'potions.txt': 'health\nmana\nfire\n' });
  repo.commit('docs: opening hours', { 'README.md': '# Potion shop\n\nOpen from dawn to dusk.\n' });
});

let repoDir: string;

/** How many commits of the rebase's sequence git applied, 0 once the rebase is over */
const appliedCount = () => {
  const donePath = path.join(repoDir, '.git', 'rebase-merge', 'done');
  return fs.existsSync(donePath) ? fs.readFileSync(donePath, 'utf8').trim().split('\n').length : 0;
};

/** Opens the conflicted file in the merge editor */
async function openMergeEditor(): Promise<void> {
  await jsClick(await $('.conflicted-section tr'));
  // The second conflict is in the file the first one left selected: that click unselected it
  const opened = await $('gitgud-merge-editor').waitForDisplayed({ timeout: 2000 }).then(() => true, () => false);
  if (!opened) await jsClick(await $('.conflicted-section tr'));
  await waitForMerge();
  await beat(800);
}

const sideButton = (side: 'left' | 'right') =>
  `.merge-editor-labels .side-label:nth-child(${side === 'left' ? 1 : 3}) button.accept-all-btn`;

/** Writes `contents` as the merge result, the editor's middle column */
const setMergeResult = (contents: string) =>
  browser.execute((text: string) => {
    const merge = document.querySelector('mis-merge3') as (HTMLElement & { ctr: string }) | null;
    if (merge) merge.ctr = text;
  }, contents);

/** Saves the merge result, then continues the rebase */
async function saveAndContinue(): Promise<void> {
  await jsClick(await byText('button', 'Save & Mark Resolved'));
  await $('gitgud-merge-editor').waitForDisplayed({ reverse: true, timeout: 10_000 });
  await browser.waitUntil(async () => (await $('button.operation-continue').getAttribute('disabled')) === null,
    { timeout: 10_000, timeoutMsg: 'Continue never became enabled' });
  await annotate('button.operation-continue', 'Continue the rebase', 'bottom', 1800);
  const appliedBefore = appliedCount();
  await jsClick(await $('button.operation-continue'));
  // The conflict list still shows this conflict until git moves on
  await browser.waitUntil(async () => appliedCount() !== appliedBefore,
    { timeout: 20_000, timeoutMsg: 'git never moved past the resolved commit' });
  await beat(1500);
}

describe('quest 9 — reorder, boss fight', () => {
  before(async () => {
    ({ repoDir } = await openQuestRepo(fixture()));
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);
    await annotateAt(await centerOfXPath(commitRowXPath('sell fire potions')), 'Fire should come before mana', 'right', 2200);
    await commitMenu('sell fire potions', 'Move commit down', 'Move it down: an interactive rebase');

    await $('span.operation-label').waitForDisplayed({ timeout: 20_000, timeoutMsg: 'the rebase never stopped on the conflict' });
    await waitForConflict();
    await beat(600);
    await annotate('span.operation-label', 'Conflict! Both commits\nedited the same lines', 'bottom', 2600);
    await annotateAt(await centerOfXPath('//h4[contains(.,"Conflicted files")]'), 'The file git couldn\'t combine', 'left', 2000);

    // Replaying "fire" onto "open the potion shop", which has no mana yet
    await openMergeEditor();
    await annotate(sideButton('left'), '"ours": in a rebase, the base\nyou replay onto (no mana yet)', 'bottom', 3200);
    await annotate(sideButton('right'), '"theirs": your commit,\nwritten after mana', 'bottom', 3000);
    await setMergeResult('health\nfire\n');
    await beat(600);
    await annotate('mis-merge3', 'Keep only fire\'s change:\nmana comes later', 'top', 2800);
    await saveAndContinue();

    // Replaying "mana" on top of fire
    await waitForConflict();
    await beat(600);
    await annotate('span.operation-label', 'Now mana replays\nonto fire: one more', 'bottom', 2200);
    await openMergeEditor();
    await setMergeResult('health\nfire\nmana\n');
    await beat(600);
    await annotate('mis-merge3', 'Keep both potions', 'top', 2400);
    await saveAndContinue();

    await $('span.operation-label').waitForDisplayed({ reverse: true, timeout: 20_000 });
    const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim();
    expect(git('log', '--format=%s')).toBe('docs: opening hours\nfeat: sell mana potions\nfeat: sell fire potions\nchore: open the potion shop');
    expect(git('show', 'HEAD~2:potions.txt')).toBe('health\nfire');
    expect(git('show', 'HEAD:potions.txt')).toBe('health\nfire\nmana');
    await see(1000);
    await annotateAt(await centerOfXPath(commitRowXPath('sell fire potions')), 'Quest cleared:\nfire now comes first', 'right', 3200);
    await see(600);
    markScene('end');
  });

});
