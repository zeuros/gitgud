// Quest 5: both branches moved on: merging them makes a merge commit with two parents
import { see } from '../../utils/helpers.js';
import { annotateAt, centerOfXPath } from '../../utils/annotations.js';
import { branchChipMenu, chipPoint, commitRow, commitRowXPath, createFixture, markScene, openQuestRepo } from './quest.js';
import { divergedShop } from './diverged-shop.js';

const fixture = () => createFixture('merge', divergedShop);

describe('quest 5 — true merge', () => {
  before(async () => {
    await openQuestRepo(fixture());
  });

  it('records the quest', async () => {
    markScene('start');
    await see(800);
    await annotateAt(await chipPoint('feature/mana'), 'feature/mana has commits\nmain doesn\'t…', 'right', 2600);
    await annotateAt(await centerOfXPath(commitRowXPath('fix: typo')), '…and main moved on too:\nthe branches diverged', 'right', 2800);

    await branchChipMenu('feature/mana', 'Merge feature/mana into main', 'Right-click → Merge');
    await commitRow('Merge branch').waitForExist({ timeout: 20_000, timeoutMsg: 'the merge commit never showed' });
    await see(1200);
    await annotateAt(await centerOfXPath(commitRowXPath('Merge branch')), 'A merge commit:\ntwo parents join both histories', 'right', 3600);
    await see(600);
    markScene('end');
  });
});
