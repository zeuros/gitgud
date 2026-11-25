// Quest 3: put half-done work aside to fix main, then take it back
import { beat, byText, jsClick, see } from '../../utils/helpers.js';
import { annotate, annotateAt, centerOfXPath } from '../../utils/annotations.js';
import {
  branchChipMenu, chipPoint, commitRow, commitRowXPath, createFixture, type FixtureRepo, markScene, openQuestRepo, openShop, typeSlowly,
  waitForToast,
} from './quest.js';

const fixture = () => createFixture('stash', repo => {
  openShop(repo);
  repo.git('switch', '-q', '-c', 'feature/mana');
  repo.commit('feat: sell mana potions', { 'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => 10;\n" });
});

const halfDoneShop = "export const potions = ['health', 'mana'];\n\nexport const price = name => name === 'mana' ? 15 : 10;\n";
const workingDirectoryRowXPath = '//tr[@data-sha="index"]';
const stashOptionXPath = '//div[contains(@class,"panel")][.//div[contains(@class,"title")][contains(.,"Stashes")]]//li[contains(@class,"p-listbox-option")]';

let repo: FixtureRepo;

const waitForBranch = (name: string) =>
  browser.waitUntil(async () => repo.git('branch', '--show-current') === name, { timeout: 15_000, timeoutMsg: `${name} was never checked out` });

describe('quest 3 — stash', () => {
  before(async () => {
    repo = await openQuestRepo(fixture());
    repo.write({ 'shop.js': halfDoneShop });
    await $(workingDirectoryRowXPath).waitForExist({ timeout: 10_000, timeoutMsg: 'the working directory row never appeared' });
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);
    await annotate('tr[data-sha="index"]', 'Half-done work on feature/mana', 'bottom', 2400);
    await annotateAt(await chipPoint('main'), 'Urgent: main needs a fix now', 'right', 2400);

    await annotate('button:has(i.fa-archive)', 'Stash: put your edits aside', 'bottom', 2200);
    await jsClick(await $('button:has(i.fa-archive)'));
    await waitForToast('Stashed');
    await $(workingDirectoryRowXPath).waitForExist({ reverse: true, timeout: 10_000 });
    await beat(800);
    await annotateAt(await centerOfXPath(stashOptionXPath), 'Safe in a stash,\nthe working tree is clean', 'right', 2600);

    await branchChipMenu('main', 'Checkout main', 'Switch to main');
    await waitForBranch('main');
    await beat(800);

    repo.write({ 'README.md': '# Potion shop\n\nSells potions to adventurers.\n\nOpen from dawn to dusk, every day.\n' });
    await $(workingDirectoryRowXPath).waitForExist({ timeout: 10_000 });
    await jsClick(await $(workingDirectoryRowXPath));
    await beat(500);
    await jsClick(await byText('button', 'Stage all'));
    await beat(600);
    await typeSlowly(await $('gitgud-make-a-commit input.commit-summary'), 'fix: open every day');
    await beat(300);
    await jsClick(await $('gitgud-make-a-commit button.commit-button'));
    await commitRow('open every day').waitForExist({ timeout: 10_000 });
    await beat(600);
    await annotateAt(await centerOfXPath(commitRowXPath('open every day')), 'Fixed on main', 'right', 1800);

    await branchChipMenu('feature/mana', 'Checkout feature/mana', 'Back to feature/mana');
    await waitForBranch('feature/mana');
    await beat(800);
    await annotate('button:has(i.fa-inbox)', 'Pop: take the stash back', 'bottom', 2000);
    await jsClick(await $('button:has(i.fa-inbox)'));
    await waitForToast('Stash popped');
    await $(workingDirectoryRowXPath).waitForExist({ timeout: 10_000, timeoutMsg: 'the stashed edits never came back' });
    expect(repo.git('status', '--porcelain')).toContain('shop.js');
    await see(800);
    await annotate('tr[data-sha="index"]', 'Your half-done work is back,\nright where you left it', 'bottom', 3200);
    await see(600);
    markScene('end');
  });
});
