// Quest 8: fold a forgotten change into a past commit, without a "fix" commit
import { beat, byText, jsClick, see, waitForDiff } from '../../utils/helpers.js';
import { annotate, annotateAt, centerOfXPath } from '../../utils/annotations.js';
import { commitRow, commitRowXPath, createFixture, markScene, openQuestRepo, openShop, waitForToast } from './quest.js';

const fixture = () => createFixture('fixup', repo => {
  openShop(repo);
  repo.commit('feat: sell mana potions', { 'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => 10;\n" });
  repo.commit('docs: thank the adventurers', { 'README.md': '# Potion shop\n\nSells potions to adventurers.\n\nOpen from dawn to dusk. Thanks for visiting!\n' });
});

describe('quest 8 — fixup', () => {
  before(async () => {
    const repo = await openQuestRepo(fixture());
    // The recipe "feat: sell mana potions" forgot
    repo.write({ 'recipes.md': '# Recipes\n\n- mana: blue herb + moonwater\n' });
    await $('//tr[contains(@class,"commit-row")][1][not(contains(.,"thank the adventurers"))]')
      .waitForExist({ timeout: 10_000, timeoutMsg: 'the working directory row never appeared' });
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);
    await annotateAt(await centerOfXPath(commitRowXPath('sell mana potions')), 'This commit forgot\nthe mana recipe', 'right', 2600);

    await jsClick((await $$('tr.commit-row'))[0]);
    await beat(600);
    await jsClick(await byText('td', 'recipes.md'));
    await waitForDiff();
    await beat(400);
    await annotate('gitgud-monaco-editor-view', 'Here it is', 'bottom', 1600);
    await jsClick(await byText('button', 'Stage all'));
    await beat(1000);

    const fixupButton = await byText('button', 'Fixup');
    await fixupButton.waitForEnabled({ timeout: 10_000 });
    await annotateAt(await centerOfXPath('//button[contains(.,"Fixup")]'), 'Fixup: add the staged changes\nto a past commit', 'left', 2600);
    await jsClick(fixupButton);
    await beat(600);
    await annotateAt(await centerOfXPath(commitRowXPath('sell mana potions')), 'Pick the commit to fix', 'right', 1800);
    await jsClick(await commitRow('sell mana potions'));
    await waitForToast('Fixup squashed');

    await see(1000);
    await jsClick(await commitRow('sell mana potions'));
    await beat(800);
    await annotateAt(await centerOfXPath(commitRowXPath('sell mana potions')), 'The recipe is in it now:\nno extra "fix" commit', 'right', 3400);
    await see(600);
    markScene('end');
  });
});
