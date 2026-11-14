import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import {
  beat,
  byText,
  clickMenuItem,
  initRepo,
  jsClick,
  rightClick,
  waitForConflict,
  waitForMenuItem,
  waitForMerge,
} from './utils/helpers.js';

// Every action running `git rebase -i` (drop, move, squash, fixup, the interactive rebase dialog), without and with a
// conflict. Each runs git twice: once to read its sequence, once to run the sequence the app wrote (RebaseService)
//
//   feat: four   c.txt = c1
//   feat: three  b.txt = b1
//   feat: two    a.txt = a2   ← conflicts once "feat: one" is dropped, moved after it or fixed up on its line
//   feat: one    a.txt = a1
//   chore: init  a.txt = a0, b.txt = b0

const TPL = '/tmp/gitgud-interactive-rebase';
const SUBJECTS = ['feat: four', 'feat: three', 'feat: two', 'feat: one', 'chore: init'];

function createFixture(): void {
  fs.rmSync(TPL, { recursive: true, force: true });
  fs.mkdirSync(TPL);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: TPL, stdio: 'pipe' });
  const commit = (subject: string, files: Record<string, string>) => {
    for (const [name, contents] of Object.entries(files)) fs.writeFileSync(path.join(TPL, name), `${contents}\n`);
    git('add', '-A');
    git('commit', '-m', subject);
  };
  git('init', '-b', 'main');
  git('config', 'user.name', 'Test Dev');
  git('config', 'user.email', 'test@gitgud.dev');
  commit('chore: init', { 'a.txt': 'a0', 'b.txt': 'b0' });
  commit('feat: one', { 'a.txt': 'a1' });
  commit('feat: two', { 'a.txt': 'a2' });
  commit('feat: three', { 'b.txt': 'b1' });
  commit('feat: four', { 'c.txt': 'c1' });
}

const rowWith = (subject: string) => $(`//tr[contains(@class,"commit-row")][contains(.,"${subject}")]`);

describe('interactive rebase — every action, with and without a conflict', () => {
  let repoDir: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trimEnd();
  const subjects = () => git('log', '--format=%s').split('\n');
  const fileAt = (rev: string, name: string) => git('show', `${rev}:${name}`);

  const commitMenu = async (subject: string, label: string) => {
    await rightClick(await rowWith(subject));
    await beat();
    await waitForMenuItem(label);
    await clickMenuItem(label);
  };

  const waitForSubjects = (expected: string[]) =>
    browser.waitUntil(async () => JSON.stringify(subjects()) === JSON.stringify(expected), {
      timeout: 20_000,
      timeoutMsg: `the history never became ${expected.join(', ')}: ${subjects().join(', ')}`,
    });

  // No rebase in progress, nor the copy of git's sequence the app works on
  const expectNoRebaseLeft = async () => {
    await $('span.operation-label').waitForDisplayed({ reverse: true, timeout: 20_000 });
    expect(fs.existsSync(path.join(repoDir, '.git', 'rebase-merge'))).toBe(false);
    expect(fs.existsSync(path.join(repoDir, '.git', 'gitgud-rebase-todo'))).toBe(false);
  };

  const waitForRebaseConflict = async () => {
    await $('span.operation-label').waitForDisplayed({ timeout: 20_000, timeoutMsg: 'the rebase never stopped on the conflict' });
    await waitForConflict();
    expect(fs.existsSync(path.join(repoDir, '.git', 'rebase-merge'))).toBe(true);
  };

  const abortRebase = async () => {
    await jsClick(await $('button.operation-abort'));
    await expectNoRebaseLeft();
  };

  // Stages `contents` in `name` behind the app's back, then fixes up `subject` with it from the commit form
  const fixup = async (name: string, contents: string, subject: string) => {
    fs.writeFileSync(path.join(repoDir, name), `${contents}\n`);
    git('add', name);
    // The working directory row comes first once the watcher saw the change: selecting it shows the commit form
    await browser.waitUntil(async () => !(await (await $$('tr.commit-row'))[0].getText()).includes('feat: four'),
      { timeout: 10_000, timeoutMsg: 'the working directory row never showed the staged change' });
    await jsClick((await $$('tr.commit-row'))[0]);
    const fixupButton = await byText('button', 'Fixup');
    await fixupButton.waitForEnabled({ timeout: 10_000, timeoutMsg: 'the Fixup button never saw the staged change' });
    await jsClick(fixupButton);
    await beat();
    await jsClick(await rowWith(subject));
  };

  before(createFixture);

  beforeEach(async () => {
    repoDir = await initRepo(TPL);
  });

  it('drops a past commit', async () => {
    await commitMenu('feat: three', 'Drop commit');
    await waitForSubjects(['feat: four', 'feat: two', 'feat: one', 'chore: init']);
    expect(fileAt('HEAD', 'b.txt')).toBe('b0');
    await expectNoRebaseLeft();
  });

  it('moves a past commit down', async () => {
    await commitMenu('feat: three', 'Move commit down');
    await waitForSubjects(['feat: four', 'feat: two', 'feat: three', 'feat: one', 'chore: init']);
    await expectNoRebaseLeft();
  });

  it('squashes a past commit into the previous one', async () => {
    await commitMenu('feat: two', 'Squash into previous commit');
    const squashButton = await byText('button', 'Squash');
    await squashButton.waitForDisplayed({ timeout: 10_000 });
    await jsClick(squashButton);
    await waitForSubjects(['feat: four', 'feat: three', 'feat: one', 'chore: init']);
    expect(fileAt('HEAD~2', 'a.txt')).toBe('a2');
    await expectNoRebaseLeft();
  });

  it('fixes up a past commit with the staged changes', async () => {
    await fixup('b.txt', 'b2', 'feat: three');
    await browser.waitUntil(() => fileAt('HEAD~1', 'b.txt') === 'b2', { timeout: 20_000, timeoutMsg: '"feat: three" never got the fixup' });
    expect(subjects()).toEqual(SUBJECTS);
    expect(git('status', '--porcelain')).toBe('');
    await expectNoRebaseLeft();
  });

  it('runs the sequence edited in the interactive rebase dialog', async () => {
    await commitMenu('feat: two', 'Interactive rebase from this commit');
    const threeAction = await $('//div[contains(@class,"rebase-entry")][contains(.,"feat: three")]//p-select');
    await threeAction.waitForDisplayed({ timeout: 10_000 });
    await jsClick(threeAction);
    const dropOption = await $('li.p-select-option[aria-label="Drop"]');
    await dropOption.waitForDisplayed({ timeout: 5_000 });
    await jsClick(dropOption);
    await jsClick(await $('button.start-rebase'));
    await waitForSubjects(['feat: four', 'feat: two', 'feat: one', 'chore: init']);
    await expectNoRebaseLeft();
  });

  it('drops a commit a later one conflicts without, resolves the conflict and continues', async () => {
    await commitMenu('feat: one', 'Drop commit');
    await waitForRebaseConflict();

    // Keep "feat: two"'s side, the commit being replayed
    await jsClick(await $('.conflicted-section tr'));
    await waitForMerge();
    await jsClick((await $$('button.accept-all-btn'))[1]);
    await jsClick(await byText('button', 'Save & Mark Resolved'));
    await $('gitgud-merge-editor').waitForDisplayed({ reverse: true, timeout: 10_000 });
    await browser.waitUntil(async () => (await $('button.operation-continue').getAttribute('disabled')) === null,
      { timeout: 10_000, timeoutMsg: 'Continue never became enabled after resolving the conflict' });
    await jsClick(await $('button.operation-continue'));

    await waitForSubjects(['feat: four', 'feat: three', 'feat: two', 'chore: init']);
    expect(fileAt('HEAD', 'a.txt')).toBe('a2');
    await expectNoRebaseLeft();
  });

  it('moves a commit before the one it conflicts with, then aborts', async () => {
    const headBefore = git('rev-parse', 'HEAD');
    await commitMenu('feat: two', 'Move commit down');
    await waitForRebaseConflict();
    await abortRebase();
    expect(git('rev-parse', 'HEAD')).toBe(headBefore);
  });

  it('fixes up a commit with a change a later one conflicts with, then aborts', async () => {
    await fixup('a.txt', 'a3', 'feat: one');
    await waitForRebaseConflict();
    await abortRebase();
    // The fixup commit made before the rebase stays, on top of the untouched history
    expect(subjects()).toEqual(['fixup! feat: one', ...SUBJECTS]);
  });
});
