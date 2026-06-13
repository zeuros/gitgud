import { allByText, beat, byText, DEMO_BASE, initRepo, jsClick, jsClickAt, pressKey, rightClickAt, typeInto, waitForDiff } from './utils/helpers.js';

describe('diff viewer — view modes, staging & commit', () => {
  before(async () => {
    await initRepo(DEMO_BASE);
  });

  it('committed diff, view modes, staging and commit', async () => {
    // ── Committed diff ───────────────────────────────────────────────────────
    await jsClick(await $('//tr[contains(@class,"commit-row") and contains(.,"add base styles")]'));
    await beat();
    await jsClick((await allByText('li', 'styles.css'))[0]);
    await waitForDiff();
    await expect($('gitgud-monaco-editor-view')).toBeDisplayed();

    // View mode switching — p-togglebutton is not a <button>, scope by .display-modes
    await jsClick(await $('//*[contains(@class,"display-modes")]//p-togglebutton[contains(.,"Inline")]'));
    await jsClick(await $('//*[contains(@class,"display-modes")]//p-togglebutton[contains(.,"Hunk")]'));
    await jsClick(await $('//*[contains(@class,"display-modes")]//p-togglebutton[contains(.,"Split")]'));
    await pressKey('Escape');

    // ── Index (working dir) ──────────────────────────────────────────────────
    await jsClick((await $$('tr.commit-row'))[0]);
    await beat();
    await jsClick((await allByText('td', 'app.js'))[0]);
    await waitForDiff();
    await expect($('gitgud-monaco-editor-view')).toBeDisplayed();

    // Stage a single line via Monaco's action trigger API.
    // showContextMenu() doesn't render in WebKit (anchor calculation needs a real mouse event).
    // We use __e2eDiffEditor (set in ngAfterViewInit) to position the cursor and trigger
    // the 'stage-line' action directly — semantically identical to clicking the context menu.
    await browser.execute(() => {
      const diffEd = (window as any).__e2eDiffEditor;
      const modEd = diffEd?.getModifiedEditor();
      if (!modEd) return;
      modEd.focus();
      modEd.setPosition({ lineNumber: 3, column: 1 });
      modEd.trigger('e2e', 'stage-line', null);
    });

    // Stage all and commit
    await jsClick(await byText('button', 'Stage all'));
    const subject = await $('input.commit-summary');
    await typeInto(subject, 'feat: add filter bar (WIP)');
    const body = await $('textarea.commit-description');
    await typeInto(body, 'Partial implementation — filter view toggle.');
    await jsClick(await byText('button', 'Commit staged changes'));
    await $('//tr[contains(@class,"commit-row") and contains(.,"add filter bar")]').waitForDisplayed({ timeout: 10_000 });

    // Theme toggle
    await jsClick(await $('button:has(span.fa-cog)'));
    await jsClick(await $('p-select.settings-select'));
    await beat();
    await jsClick(await $('//*[@role="option" and contains(.,"Light")]'));
    await jsClick(await $('p-select.settings-select'));
    await beat();
    await jsClick(await $('//*[@role="option" and contains(.,"Dark")]'));
    await jsClick(await $('p-select.settings-select'));
    await beat();
    await jsClick(await $('//*[@role="option" and contains(.,"System")]'));
    await pressKey('Escape');
  });
});
