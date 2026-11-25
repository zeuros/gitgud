// Quest 7: replay feature/mana's commits on top of main instead of merging: new commits, straight history
import { see, waitForMenuItem } from '../../utils/helpers.js';
import { annotateAt, centerOfXPath } from '../../utils/annotations.js';
import { chipPoint, clickAndWait, commitRowXPath, createFixture, dragBranchChip, markScene, menuItemXPath, openQuestRepo } from './quest.js';
import { divergedShop } from './diverged-shop.js';

const fixture = () => createFixture('rebase', repo => {
  divergedShop(repo);
  repo.git('switch', '-q', 'feature/mana');
});

describe('quest 7 — rebase onto', () => {
  before(async () => {
    await openQuestRepo(fixture());
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);
    await annotateAt(await chipPoint('main'), 'Diverged again:\nmain got a commit since', 'right', 2600);
    await annotateAt(await chipPoint('feature/mana'), 'Drag feature/mana onto main', 'right', 2000);

    await dragBranchChip('feature/mana', 'main');
    const label = 'Rebase feature/mana onto main';
    await waitForMenuItem(label);
    await annotateAt(await centerOfXPath(menuItemXPath(label)), 'Rebase: replay its commits\non top of main', 'right', 2800);
    await clickAndWait(label, 'Rebased');

    await see(1000);
    await annotateAt(await centerOfXPath(commitRowXPath('mana costs more')), 'Same changes, new commits (new SHAs)\nhistory is a straight line', 'right', 3600);
    await see(600);
    markScene('end');
  });
});
