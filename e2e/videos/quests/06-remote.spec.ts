// Quest 6: push a commit to origin, then fetch and pull a teammate's
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { jsClick, see } from '../../utils/helpers.js';
import { annotate, annotateAt, centerOfXPath } from '../../utils/annotations.js';
import { chipPoint, commitRow, commitRowXPath, createFixture, fixtureRepo, markScene, openQuestRepo, openShop, waitForToast } from './quest.js';

const fixture = () => createFixture('remote', openShop);

describe('quest 6 — sync with the remote', () => {
  let remoteDir: string;

  before(async () => {
    remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitgud-quest-origin-'));
    fixtureRepo(remoteDir).git('init', '-q', '--bare', '-b', 'main');
    await openQuestRepo(fixture(), repo => {
      repo.git('remote', 'add', 'origin', remoteDir);
      repo.git('push', '-q', '-u', 'origin', 'main');
      repo.commit('feat: sell mana potions', { 'shop.js': "export const potions = ['health', 'mana'];\n\nexport const price = name => 10;\n" });
    });
  });

  /** A teammate's clone pushes a commit to origin */
  const teammatePushes = () => {
    const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitgud-quest-teammate-'));
    const teammate = fixtureRepo(cloneDir);
    teammate.git('clone', '-q', remoteDir, '.');
    teammate.git('config', 'user.name', 'Grace Hopper');
    teammate.git('config', 'user.email', 'grace@gitgud.dev');
    teammate.commit('docs: list the potions', { 'POTIONS.md': '- health\n- mana\n' });
    teammate.git('push', '-q', 'origin', 'main');
  };

  it('records the quest', async () => {
    markScene('start');
    await see(800);
    await annotateAt(await chipPoint('main'), 'main has a commit\norigin (the remote) hasn\'t', 'right', 2800);

    await annotate('button:has(i.fa-arrow-up)', 'Push: upload your commits', 'bottom', 2000);
    await jsClick(await $('button:has(i.fa-arrow-up)'));
    await waitForToast('Pushed');
    await see(1000);
    await annotateAt(await centerOfXPath(commitRowXPath('sell mana potions')), 'origin/main caught up:\nthe upstream of main', 'right', 2800);

    teammatePushes();
    await annotate('button:has(i.fa-refresh)', 'A teammate pushed…\nFetch: download, touch nothing', 'bottom', 2400);
    await jsClick(await $('button:has(i.fa-refresh)'));
    await commitRow('list the potions').waitForExist({ timeout: 20_000, timeoutMsg: 'the fetched commit never showed' });
    await see(800);
    await annotateAt(await centerOfXPath(commitRowXPath('list the potions')), 'origin/main is ahead now\nyour main and files didn\'t move', 'right', 3000);

    await annotate('button:has(i.fa-arrow-down)', 'Pull = fetch + merge', 'bottom', 2000);
    await jsClick(await $('button:has(i.fa-arrow-down)'));
    await waitForToast('Pulled');
    await see(1000);
    await annotateAt(await chipPoint('main'), 'main fast-forwarded\nto the teammate\'s commit', 'right', 3000);
    await see(600);
    markScene('end');
  });
});
