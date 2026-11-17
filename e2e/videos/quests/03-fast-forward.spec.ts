// Quest 3: main is an ancestor of feature/mana: merging just slides the main label forward, no merge commit
import { see, waitForMenuItem } from '../../utils/helpers.js';
import { annotateAt, centerOfXPath } from '../../utils/annotations.js';
import { chipPoint, clickAndWait, createFixture, dragBranchChip, markScene, menuItemXPath, openQuestRepo, openShop } from './quest.js';

const fixture = () => createFixture('fast-forward', repo => {
  openShop(repo);
  repo.git('switch', '-q', '-c', 'feature/mana');
  repo.commit('feat: sell mana potions', { 'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => 10;\n" });
  repo.commit('feat: mana costs more', { 'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => name === 'mana' ? 15 : 10;\n" });
  repo.git('switch', '-q', 'main');
});

describe('quest 3 — fast-forward', () => {
  before(async () => {
    await openQuestRepo(fixture());
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);
    await annotateAt(await chipPoint('main'), 'main is behind:\nfeature/mana only adds commits on top', 'right', 3000);
    await annotateAt(await chipPoint('feature/mana'), 'Drag main onto feature/mana', 'right', 2000);

    await dragBranchChip('main', 'feature/mana');
    const label = 'Fast-forward main to feature/mana';
    await waitForMenuItem(label);
    await annotateAt(await centerOfXPath(menuItemXPath(label)), 'Nothing to combine:\nmain can just move forward', 'right', 2800);
    await clickAndWait(label, 'Fast-forwarded');

    await see(800);
    await annotateAt(await chipPoint('main'), 'Fast-forward: the label slid up,\nno merge commit, history stays straight', 'right', 3600);
    await see(600);
    markScene('end');
  });
});
