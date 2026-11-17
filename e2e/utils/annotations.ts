// Hand-drawn notes (rough.js arrows + labels) the video recordings draw over the app, see annotation-engine.js
import * as fs from 'fs';
import * as path from 'path';

export type Point = { x: number; y: number };
export type AnnotationSide = 'right' | 'left' | 'bottom' | 'top';

/** Installs rough.js and the annotation engine in the app window: `window.__annDraw` / `__annClear` */
export async function injectAnnotations(): Promise<void> {
  const roughSource = fs.readFileSync(path.resolve(__dirname, '../../node_modules/roughjs/bundled/rough.js'), 'utf8');
  const engineSource = fs.readFileSync(path.resolve(__dirname, 'annotation-engine.js'), 'utf8');
  // A <script> tag, so the UMD bundle sets window.rough in page scope
  const inject = (code: string) =>
    browser.execute((source: string) => {
      const script = document.createElement('script');
      script.textContent = source;
      document.head.appendChild(script);
    }, code);
  await inject(roughSource);
  await inject(engineSource);
}

/** Draws the note with its arrow tipping at `point`, holds it `ms`, then clears it */
export async function annotateAt(point: Point | null, text: string, side: AnnotationSide = 'right', ms = 3000): Promise<void> {
  if (!point) return;
  await browser.execute(
    (label: string, x: number, y: number, labelSide: string) => window.__annDraw?.(label, x, y, labelSide),
    text, point.x, point.y, side,
  );
  await browser.pause(ms);
  await browser.execute(() => window.__annClear?.());
}

/** Centre of the first element matching `selector`, or null if it's absent / not laid out */
export const centerOf = (selector: string): Promise<Point | null> =>
  browser.execute((css: string) => {
    const rect = document.querySelector(css)?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, selector);

/** Centre of the first element matching the XPath `expression` */
export const centerOfXPath = (expression: string): Promise<Point | null> =>
  browser.execute((xpath: string) => {
    const node = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const rect = (node as Element | null)?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, expression);

export async function annotate(selector: string, text: string, side: AnnotationSide = 'right', ms = 3000): Promise<void> {
  await annotateAt(await centerOf(selector), text, side, ms);
}

/** Annotates the first element matching any of `selectors` */
export async function annotateFirst(selectors: string[], text: string, side: AnnotationSide = 'right', ms = 3000): Promise<void> {
  for (const selector of selectors) {
    const point = await centerOf(selector);
    if (point) return annotateAt(point, text, side, ms);
  }
}
