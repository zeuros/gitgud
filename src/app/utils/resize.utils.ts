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

import {effect} from '@angular/core';

/**
 * Calls `onResized` whenever the element(s) `target` returns change size, observing again when `target` changes
 * (e.g. a viewChild being rendered) and disconnecting on destroy. Nothing is observed while it returns null or undefined.
 * Like effect(), must be called in an injection context.
 */
export const onResize = <T extends Element | Element[]>(target: () => T | null | undefined, onResized: (target: T) => void) =>
  effect((onCleanup) => {
    const observed = target();
    if (!observed) return;
    const ro = new ResizeObserver(() => onResized(observed));
    [observed].flat().forEach(el => ro.observe(el));
    onCleanup(() => ro.disconnect());
  });
