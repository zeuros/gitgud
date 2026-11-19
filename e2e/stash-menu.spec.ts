import { execFileSync } from 'child_process';
import { clickMenuItem, DEMO_BASE, initRepo, rightClick, waitForMenuItem } from './utils/helpers.js';

// The stash menu acts on the stash right-clicked, whatever its position in the stash list
describe('stash menu — drops the stash clicked, not the latest', () => {
  let repoDir: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trimEnd();
  const stashSubjects = () => git('stash', 'list', '--format=%s').split('\n').filter(Boolean);
  const waitForStashes = (subjects: string[], timeoutMsg: string) =>
    browser.waitUntil(async () => JSON.stringify(stashSubjects()) === JSON.stringify(subjects), { timeout: 15_000, timeoutMsg });

  before(async () => {
    repoDir = await initRepo(DEMO_BASE);
    // Staged, so each stash has its own index commit, which is the sha its log row has
    for (const name of ['stash-a', 'stash-b', 'stash-c']) {
      execFileSync('sh', ['-c', `echo ${name} >> README.md`], { cwd: repoDir });
      git('add', 'README.md');
      git('stash', 'push', '-q', '-m', name);
    }
    await $('//gitgud-left-panel//span[normalize-space()="On main: stash-a"]')
      .waitForDisplayed({ timeout: 15_000, timeoutMsg: 'the stashes never showed in the left panel' });
  });

  it('from the left panel', async () => {
    await rightClick(await $('//gitgud-left-panel//span[normalize-space()="On main: stash-b"]'));
    await waitForMenuItem('Drop stash');
    await clickMenuItem('Drop stash');
    await waitForStashes(['On main: stash-c', 'On main: stash-a'], 'stash-b, stash@{1}, was not the one dropped');
  });

  it('from the log', async () => {
    const row = $('//tr[contains(@class,"commit-row")][contains(.,"On main: stash-a")]');
    await row.waitForDisplayed({ timeout: 15_000, timeoutMsg: 'stash-a never showed in the log' });
    await rightClick(await row);
    await waitForMenuItem('Drop stash');
    await clickMenuItem('Drop stash');
    await waitForStashes(['On main: stash-c'], 'stash-a, stash@{1}, was not the one dropped');
  });
});
