// Quest 12: meld three messy commits into one before pushing
import { beat, clearInput, clickMenuItem, jsClick, rightClick, see, waitForMenuItem } from '../../utils/helpers.js';
import { annotate, annotateAt, centerOfXPath } from '../../utils/annotations.js';
import {
  commitRow, commitRowXPath, createFixture, type FixtureRepo, markScene, menuItemXPath, openQuestRepo, openShop, typeSlowly, waitForToast,
} from './quest.js';

const fixture = () => createFixture('squash', repo => {
  openShop(repo);
  repo.commit('feat: sell mana potions', { 'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => 10;\n" });
  repo.commit('wip', { 'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => name === 'mana' ? 15 : 10;\n" });
  repo.commit('wip: forgot the recipe', { 'recipes.md': '# Recipes\n\n- mana: blue herb + moonwater\n' });
});

let repo: FixtureRepo;

/** Shift+clicks the row, extending the selection to it */
const shiftClick = (subject: string) =>
  browser.execute((xpath: string) => {
    const row = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement | null;
    row?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
  }, commitRowXPath(subject));

describe('quest 12 — squash', () => {
  before(async () => {
    repo = await openQuestRepo(fixture());
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);
    await annotateAt(await centerOfXPath(commitRowXPath('forgot the recipe')), 'Three commits for one feature,\ntwo of them "wip"', 'right', 2800);

    await jsClick(await commitRow('forgot the recipe'));
    await beat(500);
    await shiftClick('sell mana potions');
    await beat(700);
    await annotateAt(await centerOfXPath(commitRowXPath('wip')), 'Shift+click: select all three', 'right', 2000);

    await rightClick(await commitRow('wip'));
    const label = 'Squash 3 commits';
    await waitForMenuItem(label);
    await beat(500);
    await annotateAt(await centerOfXPath(menuItemXPath(label)), 'Squash: meld them into one', 'right', 2200);
    await clickMenuItem(label);

    const description = await $('gitgud-squash-dialog textarea.commit-description');
    await description.waitForDisplayed({ timeout: 5000 });
    await beat(600);
    await annotate('gitgud-squash-dialog textarea.commit-description', 'Their messages, combined:\nwrite the one you want', 'right', 2800);
    await clearInput(description);
    await typeSlowly(description, 'Mana costs 15, recipe included.');
    await beat(500);
    await jsClick(await $('gitgud-squash-dialog button[type="submit"]'));
    await waitForToast('Squashed 3 commits');

    await commitRow('wip').waitForExist({ reverse: true, timeout: 10_000 });
    expect(repo.git('log', '--format=%s')).toBe('feat: sell mana potions\ndocs: opening hours\nchore: open the potion shop');
    await see(1000);
    await annotateAt(await centerOfXPath(commitRowXPath('sell mana potions')), 'One clean commit,\nready to push', 'right', 3200);
    await see(600);
    markScene('end');
  });
});
