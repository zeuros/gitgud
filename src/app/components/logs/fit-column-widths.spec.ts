import {describe, expect, it} from 'vitest';
import {fitColumnWidths} from './fit-column-widths';

describe('fitColumnWidths', () => {
  const mins = [150, 80, 150, 110, 170];

  it('keeps column shares when there is room', () => {
    expect(fitColumnWidths(1300, [1, 1, 2, 1, 1], mins)).toEqual([216, 216, 433, 216, 216]);
  });

  it('pins columns at their min and shrinks the others', () => {
    const widths = fitColumnWidths(800, [1, 1, 1, 1, 1], mins);
    expect(widths).toEqual([157, 157, 157, 157, 170]);
    widths.forEach((w, i) => expect(w).toBeGreaterThanOrEqual(mins[i]));
  });

  it('puts every column at its min when squished below the sum of mins', () => {
    expect(fitColumnWidths(400, [1, 1, 1, 1, 1], mins)).toEqual(mins);
  });

  it('never exceeds the available width', () => {
    for (const width of [660, 700, 900, 1234, 2000]) {
      const widths = fitColumnWidths(width, [260, 90, 500, 140, 190], mins);
      expect(widths.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(width);
    }
  });
});
