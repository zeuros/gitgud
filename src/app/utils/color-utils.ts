import {memoize} from 'lodash-es';

/**
 * Rotate the hue of a CSS RGBA/RGB color string by `degrees`.
 * Memoized — same (color, degrees) pair is computed only once.
 */
export const hueRotateColor = memoize(
  (primaryRgba: string, degrees: number): string => {
    const nums = primaryRgba.match(/[\d.]+/g)!.map(Number);
    const r0 = nums[0] / 255, g0 = nums[1] / 255, b0 = nums[2] / 255, a0 = nums[3] ?? 1;

    const max = Math.max(r0, g0, b0), min = Math.min(r0, g0, b0);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = d === 0 ? 0
      : max === r0 ? ((g0 - b0) / d + 6) % 6
      : max === g0 ? (b0 - r0) / d + 2
      : (r0 - g0) / d + 4;
    h = (h * 60 + degrees + 360) % 360;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r1: number, g1: number, b1: number;
    if (h < 60) [r1, g1, b1] = [c, x, 0];
    else if (h < 120) [r1, g1, b1] = [x, c, 0];
    else if (h < 180) [r1, g1, b1] = [0, c, x];
    else if (h < 240) [r1, g1, b1] = [0, x, c];
    else if (h < 300) [r1, g1, b1] = [x, 0, c];
    else [r1, g1, b1] = [c, 0, x];

    return `rgba(${Math.round((r1 + m) * 255)},${Math.round((g1 + m) * 255)},${Math.round((b1 + m) * 255)},${a0})`;
  },
  (rgba, deg) => `${rgba}|${deg}`,
);

/** Compute `count` evenly hue-spaced variants of a base color. Memoized. */
export const computeGraphColors = (primaryRgb: string, count = 7) =>
  Array.from({length: count}, (_, i) => hueRotateColor(primaryRgb, i * 360 / count));
