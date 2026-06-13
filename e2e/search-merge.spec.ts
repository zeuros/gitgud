import { addRepoViaUI, byText, clearInput, DEMO_BASE, DEMO_CONFLICT, initRepo, jsClick, pressKey, typeInto, waitForMerge } from './utils/helpers.js';

describe('graph search, git command log & merge editor', () => {
  before(async () => {
    await initRepo(DEMO_BASE);
  });

  it('search by keyword, SHA, author; command log; merge editor conflict resolution', async () => {
    // ── Graph search ─────────────────────────────────────────────────────────
    await pressKey('f', { ctrl: true });
    await $('gitgud-search-logs input[name="search"]').waitForDisplayed({ timeout: 10_000 });

    const searchInput = await $('gitgud-search-logs input[name="search"]');

    // Search by keyword
    await typeInto(searchInput, 'keyboard');
    await expect($('tr.commit-row')).toBeDisplayed();

    // Search by SHA prefix
    await clearInput(searchInput);
    const firstSha = await (await $('tr.commit-row')).getAttribute('id') ?? '';
    const shaPrefix = firstSha.slice(0, 7);
    if (shaPrefix) {
      await typeInto(searchInput, shaPrefix);
      await expect($('tr.commit-row')).toBeDisplayed();
    }

    // Search by author
    await clearInput(searchInput);
    await typeInto(searchInput, 'Demo Dev');
    await expect($('tr.commit-row')).toBeDisplayed();
    await pressKey('Escape');

    // ── Git command log ───────────────────────────────────────────────────────
    await jsClick(await $('button:has(span.fa-terminal)'));
    await expect($('//*[contains(text(),"Git Command History")]')).toBeDisplayed();
    await pressKey('Escape');

    // ── Merge editor ──────────────────────────────────────────────────────────
    // Open the conflict repo via the UI + button — no reload needed.
    // pickFolderAndOpenRepository selects the new repo and starts refreshAll().
    await addRepoViaUI(DEMO_CONFLICT);
    await expect($('.conflicted-section')).toBeDisplayed({ timeout: 10_000 });

    // Conflicted file opens three-way merge editor
    await jsClick(await $('.conflicted-section tr'));
    await waitForMerge();
    await expect($('gitgud-merge-editor')).toBeDisplayed();

    // Accept ours and theirs
    const acceptBtns = await $$('button.accept-all-btn');
    await jsClick(acceptBtns[0]);
    await jsClick(acceptBtns[1]);

    // Mark as resolved
    await jsClick(await byText('button', 'Save & Mark Resolved'));
    await $('gitgud-merge-editor').waitForDisplayed({ reverse: true, timeout: 10_000 });
  });
});
