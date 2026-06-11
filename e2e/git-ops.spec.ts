import { beat, DEMO_BASE, initRepo, jsClick, pressKey, typeInto } from './utils/helpers.js';

describe('git ops — commit graph, branch nav, stash, create branch', () => {
  before(async () => {
    await initRepo(DEMO_BASE);
  });

  it('commit graph, branch navigation, stash/pop, create branch', async () => {
    // Commit graph loaded
    await expect($('tr.commit-row')).toBeDisplayed();
    const initialCount = (await $$('tr.commit-row')).length;
    expect(initialCount).toBeGreaterThan(3);

    // Branch navigation — XPath to match span text inside tree node
    await jsClick(await $('//*[contains(@class,"p-tree-node-selectable")]//span[contains(.,"dark-mode")]'));
    await jsClick(await $('//*[contains(@class,"p-tree-node-selectable")]//span[normalize-space(.)="main"]'));

    // Fetch — button exists and responds
    await jsClick(await $('button:has(i.fa-refresh)'));

    // Stash — WIP entry disappears
    await jsClick(await $('button:has(i.fa-archive)'));
    await beat();
    await expect($$('tr.commit-row')).toBeElementsArrayOfSize(initialCount);

    // Pop — stash entry removed
    await jsClick(await $('button:has(i.fa-inbox)'));
    await beat();
    await expect($$('tr.commit-row')).toBeElementsArrayOfSize(initialCount);

    // Create branch — appears in branch panel
    await jsClick((await $$('button:has(i.fa-code-fork)'))[0]);
    const input = await $('input.branch-name-input');
    await typeInto(input, 'ci/test-branch');
    await pressKey('Enter');
    await expect(
      $('//*[contains(@class,"p-splitterpanel")]//*[contains(@class,"p-tree-node-selectable")]//span[contains(.,"test-branch")]'),
    ).toBeDisplayed();
  });
});
