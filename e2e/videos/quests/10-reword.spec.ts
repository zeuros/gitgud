// Quest 10: fix the message of a past commit
import { beat, byText, clearInput, jsClick, see } from '../../utils/helpers.js';
import { annotate, annotateAt, centerOfXPath } from '../../utils/annotations.js';
import { commitRow, commitRowXPath, createFixture, markScene, openQuestRepo, openShop, typeSlowly } from './quest.js';

const fixture = () => createFixture('reword', repo => {
  openShop(repo);
  repo.commit('feat: sell mana potoins', { 'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => 10;\n" });
  repo.commit('feat: mana costs more', { 'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => name === 'mana' ? 15 : 10;\n" });
});

describe('quest 10 — reword', () => {
  before(async () => {
    await openQuestRepo(fixture());
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);
    await annotateAt(await centerOfXPath(commitRowXPath('potoins')), 'A typo, two commits ago', 'right', 2400);

    await jsClick(await commitRow('potoins'));
    await beat(800);
    const summary = await $('gitgud-commit-infos input.commit-summary');
    await annotate('gitgud-commit-infos input.commit-summary', 'Edit the message here', 'left', 2000);
    await clearInput(summary);
    await typeSlowly(summary, 'feat: sell mana potions');
    await beat(400);

    const updateButton = await byText('button', 'Update message');
    await annotateAt(await centerOfXPath('//button[contains(.,"Update message")]'), 'Reword it', 'left', 1600);
    await jsClick(updateButton);
    await commitRow('sell mana potions').waitForExist({ timeout: 20_000, timeoutMsg: 'the reworded commit never showed' });
    await see(1000);
    await annotateAt(await centerOfXPath(commitRowXPath('sell mana potions')), 'Fixed: this commit and the ones\nafter it got new SHAs', 'right', 3400);
    await see(600);
    markScene('end');
  });
});
