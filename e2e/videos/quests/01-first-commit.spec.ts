// Quest 1: stage changes from the working tree into the index, then commit them
import { beat, byText, jsClick, see, typeInto, waitForDiff } from '../../utils/helpers.js';
import { annotate, annotateAt, centerOfXPath } from '../../utils/annotations.js';
import { commitRow, createFixture, markScene, openQuestRepo } from './quest.js';

const fixture = () => createFixture('first-commit', repo => {
  repo.commit('chore: open the potion shop', {
    'README.md': '# Potion shop\n\nSells potions to adventurers.\n',
    'shop.js': "export const potions = ['health'];\n\nexport const price = name => 10;\n",
  });
});

describe('quest 1 — first commit', () => {
  before(async () => {
    const templateDir = fixture();
    const repo = await openQuestRepo(templateDir);
    // Edits made after opening, so the watcher shows them arriving
    repo.write({
      'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => name === 'mana' ? 15 : 10;\n",
      'recipes.md': '# Recipes\n\n- mana: blue herb + moonwater\n',
    });
    await $('//tr[contains(@class,"commit-row")][1][not(contains(.,"open the potion shop"))]')
      .waitForExist({ timeout: 10_000, timeoutMsg: 'the working directory row never appeared' });
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);

    const workingDirectoryRow = (await $$('tr.commit-row'))[0];
    await jsClick(workingDirectoryRow);
    await beat(800);
    await annotate('tr.commit-row', 'Your edits, not committed yet\nthe working tree', 'bottom', 2800);

    await jsClick(await byText('td', 'shop.js'));
    await waitForDiff();
    await beat(600);
    await annotate('gitgud-monaco-editor-view', 'What changed in shop.js', 'bottom', 2500);

    const stageAllPoint = await centerOfXPath('//button[normalize-space()="Stage all"]');
    await annotateAt(stageAllPoint, 'Stage: pick what goes\ninto the next commit', 'left', 2200);
    await jsClick(await byText('button', 'Stage all'));
    await browser.waitUntil(async () => browser.execute(() =>
      Array.from(document.querySelectorAll('h4')).some(h => /Staged files \(2\)/.test(h.textContent ?? ''))),
    { timeout: 8000, timeoutMsg: 'the files were never staged' });
    await beat(800);
    await annotateAt(await centerOfXPath('//h4[contains(.,"Staged files")]'), 'The index (staging area)\nholds the next commit', 'left', 2800);

    const summary = await $('gitgud-make-a-commit input.commit-summary');
    for (const word of ['feat: ', 'sell ', 'mana ', 'potions'])
      await typeInto(summary, word).then(() => beat(180));
    await beat(500);
    await annotate('gitgud-make-a-commit button.commit-button', 'Commit: a snapshot\nwith a message', 'top', 2200);
    await jsClick(await $('gitgud-make-a-commit button.commit-button'));

    await commitRow('feat: sell mana potions').waitForExist({ timeout: 10_000, timeoutMsg: 'the commit never showed in the log' });
    await beat(1000);
    await annotateAt(await centerOfXPath('//tr[contains(@class,"commit-row")][contains(.,"sell mana potions")]'),
      'Your first commit\nHEAD points to it', 'bottom', 3000);
    await see(800);
    markScene('end');
  });
});
