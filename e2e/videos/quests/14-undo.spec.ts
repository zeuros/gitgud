// Quest 14: drop a commit by mistake, then undo it (GitGud reads the reflog)
import { jsClick, see } from '../../utils/helpers.js';
import { annotate, annotateAt, centerOfXPath } from '../../utils/annotations.js';
import { commitMenu, commitRow, commitRowXPath, createFixture, markScene, openQuestRepo, openShop, waitForToast } from './quest.js';

const fixture = () => createFixture('undo', repo => {
  openShop(repo);
  repo.commit('feat: sell mana potions', { 'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => 10;\n" });
  repo.commit('feat: mana costs more', { 'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => name === 'mana' ? 15 : 10;\n" });
});

describe('quest 14 — undo anything', () => {
  before(async () => {
    await openQuestRepo(fixture());
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);
    await commitMenu('mana costs more', 'Drop commit', 'Oops: dropping the wrong commit');
    await commitRow('mana costs more').waitForExist({ reverse: true, timeout: 20_000, timeoutMsg: 'the commit was never dropped' });
    await see(800);
    await annotateAt(await centerOfXPath(commitRowXPath('sell mana potions')), 'It\'s gone…', 'right', 2000);

    await annotate('button:has(i.fa-history)', 'Undo: git\'s reflog remembers\nwhere HEAD was', 'bottom', 2800);
    await jsClick(await $('button:has(i.fa-history)'));
    await waitForToast('Undone');
    await commitRow('mana costs more').waitForExist({ timeout: 20_000, timeoutMsg: 'the commit never came back' });
    await see(1000);
    await annotateAt(await centerOfXPath(commitRowXPath('mana costs more')), '…and back. Nothing committed\nis ever really lost', 'right', 3400);
    await see(600);
    markScene('end');
  });
});
