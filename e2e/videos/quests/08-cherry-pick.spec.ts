// Quest 8: copy one commit of another branch onto main, without merging the rest
import { see } from '../../utils/helpers.js';
import { annotateAt, centerOfXPath } from '../../utils/annotations.js';
import { chipPoint, commitMenu, commitRowXPath, createFixture, type FixtureRepo, markScene, openQuestRepo, openShop, waitForToast } from './quest.js';

const fixture = () => createFixture('cherry-pick', repo => {
  openShop(repo);
  repo.git('switch', '-q', '-c', 'feature/mana');
  repo.commit('feat: mana recipe', { 'recipes.md': '# Recipes\n\n- mana: blue herb + moonwater\n' });
  repo.commit('fix: health potions cost 5', { 'shop.js': "export const potions = ['health'];\n\nexport const price = name => 5;\n" });
  repo.commit('wip: mana potion label', { 'recipes.md': '# Recipes\n\n- mana: blue herb + moonwater\n- label: TODO\n' });
  repo.git('switch', '-q', 'main');
});

let repo: FixtureRepo;

describe('quest 8 — cherry-pick', () => {
  before(async () => {
    repo = await openQuestRepo(fixture());
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);
    await annotateAt(await centerOfXPath(commitRowXPath('health potions cost 5')), 'main needs this fix…', 'right', 2200);
    await annotateAt(await centerOfXPath(commitRowXPath('wip: mana potion label')), '…but not the unfinished rest\nof feature/mana', 'right', 2600);

    await commitMenu('health potions cost 5', 'Cherry pick commit', 'Cherry-pick: copy this commit onto HEAD');
    await waitForToast('Cherry picked');
    await browser.waitUntil(async () => repo.git('log', '-1', '--format=%s', 'main') === 'fix: health potions cost 5',
      { timeout: 10_000, timeoutMsg: 'the fix never landed on main' });

    await see(1200);
    await annotateAt(await chipPoint('main'), 'A copy on main: same change,\nnew commit, new SHA', 'right', 3200);
    await annotateAt(await chipPoint('feature/mana'), 'feature/mana is untouched', 'right', 2200);
    await see(600);
    markScene('end');
  });
});
