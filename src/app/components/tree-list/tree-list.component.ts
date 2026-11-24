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

import {ChangeDetectionStrategy, Component, computed, contentChild, ElementRef, inject, input, output, signal, type TemplateRef} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import type {TreeNode} from 'primeng/api';
import {rowsInView, visibleRows} from '../../utils/tree-utils';
import {onResize} from '../../utils/resize.utils';

const ROW_HEIGHT_PX = 30;
const OVERSCAN_ROWS = 10;

export interface TreeNodeContextMenuEvent<T> {
  node: TreeNode<T>;
  event: MouseEvent;
}

/**
 * A scrolling tree that only renders the rows in view, all rows being ROW_HEIGHT_PX high.
 * Clicking a node holding data selects it, clicking a folder expands or collapses it; every node starts expanded.
 * The `#node` template renders a row's label, given the node.
 */
@Component({
  selector: 'gitgud-tree-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgTemplateOutlet],
  host: {'role': 'tree', '(scroll)': 'scrollTop.set(host.scrollTop)'},
  templateUrl: './tree-list.component.html',
  styleUrl: './tree-list.component.scss',
})
export class TreeListComponent<T> {

  protected host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  nodes = input.required<TreeNode<T>[]>();
  selectedKey = input<string>();
  emptyMessage = input('');
  nodeSelect = output<TreeNode<T>>();
  nodeDoubleClick = output<TreeNode<T>>();
  nodeContextMenu = output<TreeNodeContextMenuEvent<T>>();
  protected nodeTemplate = contentChild.required<TemplateRef<{$implicit: TreeNode<T>}>>('node');

  private collapsedKeys = signal<ReadonlySet<string>>(new Set());
  protected scrollTop = signal(0);
  private viewportHeight = signal(0);
  protected rows = computed(() => visibleRows(this.nodes(), this.collapsedKeys()));
  protected renderWindow = computed(
    () => rowsInView(this.scrollTop(), this.viewportHeight(), ROW_HEIGHT_PX, OVERSCAN_ROWS, this.rows().length),
    {equal: (a, b) => a.from === b.from && a.to === b.to},
  );

  protected ROW_HEIGHT_PX = ROW_HEIGHT_PX;

  constructor() {
    onResize(() => this.host, host => this.viewportHeight.set(host.clientHeight));
  }

  protected isExpanded = (node: TreeNode<T>) => !this.collapsedKeys().has(node.key!);

  protected onClick = (node: TreeNode<T>) => {
    if (node.data) this.nodeSelect.emit(node);
    else this.toggle(node);
  };

  protected onContextMenu = (node: TreeNode<T>, event: MouseEvent) => {
    event.preventDefault();
    this.nodeContextMenu.emit({node, event});
  };

  private toggle = ({key}: TreeNode<T>) => this.collapsedKeys.update(keys => {
    const toggled = new Set(keys);
    if (!toggled.delete(key!)) toggled.add(key!);
    return toggled;
  });
}
