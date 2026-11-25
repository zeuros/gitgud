// Quest 6: GitGud predicts the merge's conflict before it runs, then the merge editor combines both sides
import { beat, clickMenuItem, jsClick, rightClick, see, waitForConflict, waitForMenuItem } from '../../utils/helpers.js';
import { annotate, annotateAt, centerOfXPath } from '../../utils/annotations.js';
import {
  branchChip, chipPoint, commitRow, commitRowXPath, createFixture, type FixtureRepo, markScene, menuItemXPath, mergeSideButton, openMergeEditor,
  openQuestRepo, openShop, saveMergeResult, setMergeResult,
} from './quest.js';

const fixture = () => createFixture('merge-conflict', repo => {
  openShop(repo);
  repo.git('switch', '-q', '-c', 'feature/mana');
  repo.commit('feat: mana potions cost 15', { 'shop.js': "export const potions = ['health'];\n\nexport const price = name => name === 'mana' ? 15 : 10;\n" });
  repo.git('switch', '-q', 'main');
  repo.commit('feat: prices go up', { 'shop.js': "export const potions = ['health'];\n\nexport const price = name => 12;\n" });
});

const mergedShop = "export const potions = ['health'];\n\nexport const price = name => name === 'mana' ? 15 : 12;\n";

let repo: FixtureRepo;

describe('quest 6 — see the conflict coming', () => {
  before(async () => {
    repo = await openQuestRepo(fixture());
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);
    await annotateAt(await centerOfXPath(commitRowXPath('prices go up')), 'main changed the price line…', 'right', 2400);
    await annotateAt(await centerOfXPath(commitRowXPath('mana potions cost 15')), '…and so did feature/mana', 'right', 2400);

    await rightClick(await $(branchChip('feature/mana')));
    const label = 'Merge feature/mana into main (1 conflicting file)';
    await waitForMenuItem(label);
    await beat(500);
    await annotateAt(await centerOfXPath(menuItemXPath(label)), 'GitGud sees it coming:\na conflict, before you merge', 'right', 3000);
    await clickMenuItem(label);

    await $('span.operation-label').waitForDisplayed({ timeout: 20_000, timeoutMsg: 'the merge never stopped on the conflict' });
    await waitForConflict();
    await beat(600);
    await annotate('span.operation-label', 'The merge waits for you', 'bottom', 2000);

    await openMergeEditor();
    await annotate(mergeSideButton('left'), '"ours": main,\nthe branch you merge into', 'bottom', 2600);
    await annotate(mergeSideButton('right'), '"theirs": feature/mana', 'bottom', 2200);
    await setMergeResult(mergedShop);
    await beat(600);
    await annotate('mis-merge3', 'Keep both: mana at 15,\nthe rest at 12', 'top', 2800);
    await saveMergeResult();
    await annotate('button.operation-continue', 'Continue: commit the merge', 'bottom', 2000);
    await jsClick(await $('button.operation-continue'));

    await $('span.operation-label').waitForDisplayed({ reverse: true, timeout: 20_000 });
    await commitRow('Merge branch').waitForExist({ timeout: 20_000, timeoutMsg: 'the merge commit never showed' });
    expect(repo.git('show', 'HEAD:shop.js') + '\n').toBe(mergedShop);
    await see(1000);
    await annotateAt(await chipPoint('main'), 'Conflict resolved:\nboth changes, one merge commit', 'right', 3400);
    await see(600);
    markScene('end');
  });
});
