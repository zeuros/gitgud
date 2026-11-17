// Quest 2: create a branch, commit on it: the branch moves, main stays
import { beat, byText, jsClick, pressKey, see } from '../../utils/helpers.js';
import { annotate, annotateAt, centerOfXPath } from '../../utils/annotations.js';
import { chipPoint, commitRow, commitRowXPath, createFixture, markScene, openQuestRepo, openShop, typeSlowly } from './quest.js';

const fixture = () => createFixture('branch', openShop);

describe('quest 2 — branch out', () => {
  let write: (files: Record<string, string>) => void;

  before(async () => {
    ({ write } = await openQuestRepo(fixture()));
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);
    await annotateAt(await chipPoint('main'), 'A branch is a label\non a commit', 'right', 2600);

    await annotate('button:has(i.fa-code-fork)', 'New branch from HEAD', 'bottom', 1800);
    await jsClick((await $$('button:has(i.fa-code-fork)'))[0]);
    const nameInput = await $('input.branch-name-input');
    await nameInput.waitForDisplayed({ timeout: 5000 });
    await typeSlowly(nameInput, 'feature/mana');
    await beat(400);
    await pressKey('Enter');
    await $('//div[contains(@class,"draggable-chip")][contains(.,"feature/mana")]').waitForExist({ timeout: 10_000 });
    await beat(1000);
    await annotateAt(await chipPoint('feature/mana'), 'Checked out:\nHEAD now follows feature/mana', 'right', 2800);

    // A commit on the new branch, made from the commit form
    write({ 'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => 10;\n" });
    await $('//tr[contains(@class,"commit-row")][1][not(contains(.,"opening hours"))]').waitForExist({ timeout: 10_000 });
    await jsClick((await $$('tr.commit-row'))[0]);
    await beat(600);
    await jsClick(await byText('button', 'Stage all'));
    await beat(800);
    await typeSlowly(await $('gitgud-make-a-commit input.commit-summary'), 'feat: sell mana potions');
    await beat(300);
    await jsClick(await $('gitgud-make-a-commit button.commit-button'));
    await commitRow('sell mana potions').waitForExist({ timeout: 10_000 });
    await beat(1200);

    await annotateAt(await centerOfXPath(commitRowXPath('sell mana potions')), 'feature/mana moved forward…', 'bottom', 2400);
    await annotateAt(await chipPoint('main'), '…main stayed behind', 'right', 2600);
    await see(600);
    markScene('end');
  });
});
