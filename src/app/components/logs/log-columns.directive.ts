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

import {DestroyRef, Directive, effect, ElementRef, inject, input, linkedSignal, signal} from '@angular/core';
import {fitColumnWidths} from './fit-column-widths';
import {onResize} from '../../utils/resize.utils';
import {LocalStorageService} from '../../services/local-storage.service';
import {type StorageKey, StorageName} from '../../enums/storage-name.enum';

// Default log column widths, relative to each other (Branch / Tag, Graph, Commit message, Author, Commit date / time).
// Commit date / time is fixed at its min-width, which fits its content
const LOG_COLUMN_SHARES = [3, 2, 5, 1.5, 0];

// Share 0 = fixed column, always at its min-width
const withFixedColumns = (shares: number[]) => shares.map((share, i) => LOG_COLUMN_SHARES[i] ? share : 0);

// Saved as {columnWidths: "w1,w2,…"}, the format p-table's stateStorage used, so widths saved by older versions still apply
interface SavedColumns {
  columnWidths?: string;
}

/**
 * Sizes the log table's columns: they fill the scroll container's width, keep their share of it when it changes,
 * and never go below their min-width (the th's min-width style). Dragging a `.column-resizer` in a th trades width with
 * the next column, down to either one's min-width; the resulting widths are saved per repository (`gitgudLogColumns`, its id).
 */
@Directive({
  selector: 'table[gitgudLogColumns]',
  host: {'(mousedown)': 'startResize($event)'},
})
export class LogColumnsDirective {

  repoId = input.required<string | undefined>({alias: 'gitgudLogColumns'});

  private localStorage = inject(LocalStorageService);
  private storageKey = (): StorageKey => `${StorageName.LogColumns}-${this.repoId()}`;
  private table = inject<ElementRef<HTMLTableElement>>(ElementRef).nativeElement;
  private destroyRef = inject(DestroyRef);
  private containerWidth = signal(0);
  private shares = linkedSignal(() => withFixedColumns(this.loadShares() ?? LOG_COLUMN_SHARES));

  constructor() {
    onResize(() => this.table.parentElement, container => this.containerWidth.set(container.clientWidth));
    effect(() => this.layout(this.containerWidth(), this.shares()));
  }

  private loadShares = () => {
    const widths = this.localStorage.get<SavedColumns>(this.storageKey())?.columnWidths?.split(',').map(Number);
    return widths?.length === LOG_COLUMN_SHARES.length && widths.every(w => w > 0) ? widths : undefined;
  };

  private saveShares = (widths: number[]) =>
    this.localStorage.store(this.storageKey(), {columnWidths: widths.map(Math.round).join(',')} satisfies SavedColumns);

  private headers = () => [...this.table.querySelectorAll<HTMLElement>(':scope > thead > tr > th')];

  private minWidth = (th: HTMLElement) => parseFloat(th.style.minWidth) || 0;

  private layout = (containerWidth: number, shares: number[]) => {
    const ths = this.headers();
    if (!containerWidth || ths.length !== shares.length) return;
    const widths = fitColumnWidths(containerWidth, shares, ths.map(this.minWidth));
    ths.forEach((th, i) => th.style.width = `${widths[i]}px`);
    this.table.style.width = `${widths.reduce((sum, w) => sum + w, 0)}px`;
  };

  protected startResize = (event: MouseEvent) => {
    const resizer = (event.target as Element).closest('.column-resizer');
    const ths = this.headers();
    const index = ths.findIndex(th => th.contains(resizer));
    if (!resizer || index < 0 || index === ths.length - 1 || event.button !== 0) return;
    event.preventDefault(); // no text selection while dragging

    const startX = event.clientX;
    const startWidths = ths.map(th => th.getBoundingClientRect().width);
    const [th, next] = [ths[index], ths[index + 1]];
    // The dragged edge moves between the two columns' min-widths
    const minDx = this.minWidth(th) - startWidths[index];
    const maxDx = startWidths[index + 1] - this.minWidth(next);
    let widths = startWidths;

    const onMove = (move: MouseEvent) => {
      const dx = Math.min(maxDx, Math.max(minDx, move.clientX - startX));
      widths = startWidths.map((w, i) => i === index ? w + dx : i === index + 1 ? w - dx : w);
      th.style.width = `${widths[index]}px`;
      next.style.width = `${widths[index + 1]}px`;
    };
    const stop = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', stop);
      document.body.classList.remove('column-resizing');
      stopOnDestroy();
      this.shares.set(withFixedColumns(widths));
      this.saveShares(widths);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', stop);
    document.body.classList.add('column-resizing');
    const stopOnDestroy = this.destroyRef.onDestroy(stop);
  };
}
