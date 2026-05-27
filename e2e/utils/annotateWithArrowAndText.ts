/**
 * E2E-only annotation layer — injects a rough.js SVG overlay
 * into the Electron renderer so curved arrows and narration appear in videos.
 * Never imported by the Angular app; roughjs stays in devDependencies.
 */
import {Locator, Page} from '@playwright/test';
import * as path from 'path';
import {see} from './helpers';

export type Side = 'right' | 'bottom';

const ROUGH_JS  = path.join(__dirname, '../../node_modules/roughjs/bundled/rough.js');
const ENGINE_JS = path.join(__dirname, 'annotation-engine.js');

/** Inject rough.js + annotation engine. Call after launch and after every reload. */
export async function setupAnnotations(page: Page): Promise<void> {
  await page.addScriptTag({path: ROUGH_JS});
  await page.addScriptTag({path: ENGINE_JS});
}

/**
 * Draw a rough curved arrow pointing at the centre of `selector`.
 * `text` is shown at the arrow tail (start point); use `\n` for multiple lines.
 */
export async function annotateWithArrowAndText(
  page: Page,
  selector: string | Locator,
  text: string,
  side: Side = 'right',
  offsetX = 0,
  offsetY = 0,
  showDuration = 4000,
): Promise<void> {
  const locator = typeof selector === 'string' ? page.locator(selector).first() : selector.first();
  const box = await locator.boundingBox({timeout: 5000}).catch(() => null);
  if (!box) return;
  await page.evaluate(
    ({t, tx, ty, s}) => (window as any).__annDraw(t, tx, ty, s),
    {t: text, tx: box.x + box.width / 2 + offsetX, ty: box.y + box.height / 2 + offsetY, s: side},
  );
  await see(page, showDuration);
  await clearAnnotations(page);
}

/** Remove all arrows and labels. */
export const clearAnnotations = (page: Page): Promise<void> =>
  page.evaluate(() => (window as any).__annClear?.());
