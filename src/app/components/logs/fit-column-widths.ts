/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Splits availableWidth between columns proportionally to their shares, never below their min widths:
 * columns that would go below their min are pinned to it and the rest is split among the others.
 * Below the sum of min widths, every column is at its min (the table overflows).
 */
export const fitColumnWidths = (availableWidth: number, shares: number[], minWidths: number[]): number[] => {
  const pinned = new Set<number>();
  for (;;) {
    const free = shares.map((_, i) => i).filter(i => !pinned.has(i));
    const freeWidth = availableWidth - [...pinned].reduce((sum, i) => sum + minWidths[i], 0);
    const freeShares = free.reduce((sum, i) => sum + shares[i], 0);
    const widths = shares.map((share, i) => pinned.has(i) ? minWidths[i] : freeShares > 0 ? freeWidth * share / freeShares : freeWidth / free.length);
    const tooSmall = free.filter(i => widths[i] < minWidths[i]);
    if (!tooSmall.length) return widths.map(Math.floor);
    tooSmall.forEach(i => pinned.add(i));
  }
};
