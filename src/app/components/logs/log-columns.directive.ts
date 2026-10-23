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

import {afterNextRender, DestroyRef, Directive, ElementRef, inject} from '@angular/core';
import {Table} from 'primeng/table';
import {fitColumnWidths} from './fit-column-widths';

// Default log column widths, relative to each other (Branch / Tag, Graph, Commit message, Author, Commit date / time).
// Commit date / time is fixed at its min-width, which fits its content
const LOG_COLUMN_SHARES = [3, 2, 5, 1.5, 0];

/**
 * Sizes the log table's columns: they fill the panel width, keep their share of it when it changes, and never go
 * below their min-width (neither when fitting nor while the user resizes one).
 */
@Directive({selector: 'p-table[gitgudLogColumns]'})
export class LogColumnsDirective {

  private table = inject(Table);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.clampColumnResize();
    afterNextRender(() => this.fitColumnsToWidth());
  }

  // PrimeNG cancels a column resize that goes below a column's min-width (see Table.onColumnResizeEnd).
  // Clamp the resize helper line while dragging instead, so the resize stops at the resized/next column's min-width.
  private clampColumnResize = () => {

    const onColumnResize = this.table.onColumnResize.bind(this.table);

    this.table.onColumnResize = (event: MouseEvent) => {
      onColumnResize(event);
      const th: HTMLElement | undefined = this.table.resizeColumnElement;
      const next = th?.nextElementSibling as HTMLElement | null;
      const helper: HTMLElement | undefined = this.table.resizeHelperViewChild()?.nativeElement;
      const startX = this.table.lastResizerHelperX;
      if (!th || !next || !helper || startX === undefined) return;
      const minWidth = (el: HTMLElement) => parseFloat(el.style.minWidth) || 16; // PrimeNG requires > 15px
      const min = startX - (th.offsetWidth - minWidth(th));
      const max = startX + (next.offsetWidth - minWidth(next));
      helper.style.left = `${Math.min(max, Math.max(min, parseFloat(helper.style.left)))}px`;
    };
  };

  // Fit the columns to the panel width by share (saved / user-resized widths), never below their min-width, which
  // fixed table layout ignores. The table only scrolls horizontally once every column is at its min.
  private fitColumnsToWidth = () => {
    const container = this.host.nativeElement.querySelector<HTMLElement>('.p-datatable-table-container');
    const table = container?.querySelector('table');
    const ths = [...table?.querySelectorAll('th') ?? []];
    if (!container || !table || ths.length !== LOG_COLUMN_SHARES.length) return;

    // Share 0 = fixed column, always at its min-width
    const withFixedColumns = (shares: number[]) => shares.map((share, i) => LOG_COLUMN_SHARES[i] ? share : 0);
    const minWidths = ths.map(th => parseFloat(th.style.minWidth) || 16);
    const savedWidths = this.table.columnWidthsState?.split(',').map(Number);
    let shares = withFixedColumns(savedWidths?.length === ths.length ? savedWidths : LOG_COLUMN_SHARES);

    const layout = () => {
      // PrimeNG applies restored / resized widths with a `width: …px !important` stylesheet, which would win over ours
      if (this.table.styleElement) this.table.styleElement.innerHTML = '';
      const widths = fitColumnWidths(container.clientWidth, shares, minWidths);
      ths.forEach((th, i) => th.style.width = `${widths[i]}px`);
      table.style.width = `${widths.reduce((sum, w) => sum + w, 0)}px`;
      table.style.minWidth = '';
    };

    const ro = new ResizeObserver(layout);
    ro.observe(container);
    const sub = this.table.onColResize.subscribe(() => {
      shares = withFixedColumns(ths.map(th => th.offsetWidth)); // widths PrimeNG just applied for the resize
      layout();
    });
    this.destroyRef.onDestroy(() => {
      ro.disconnect();
      sub.unsubscribe();
    });
  };
}
