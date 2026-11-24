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
import {rowsInView, treeKeyAction, visibleRows} from '../../utils/tree-utils';
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
 * The keyboard moves a focus between the rows and activates the focused one as a click does (see treeKeyAction);
 * the focused node is the one the tree's other keys, such as menu shortcuts, act on.
 */
@Component({
  selector: 'gitgud-tree-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgTemplateOutlet],
  host: {'role': 'tree', 'tabindex': '0', '(scroll)': 'scrollTop.set(host.scrollTop)', '(keydown)': 'onKeydown($event)'},
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
  // The keyboard's position: the selected node until a click or a key moves it
  private focusedKeyState = signal<string | undefined>(undefined);
  protected scrollTop = signal(0);
  private viewportHeight = signal(0);
  protected rows = computed(() => visibleRows(this.nodes(), this.collapsedKeys()));
  protected renderWindow = computed(
    () => rowsInView(this.scrollTop(), this.viewportHeight(), ROW_HEIGHT_PX, OVERSCAN_ROWS, this.rows().length),
    {equal: (a, b) => a.from === b.from && a.to === b.to},
  );

  protected focusedKey = computed(() => {
    const key = this.focusedKeyState();
    return key && this.rows().some(row => row.node.key === key) ? key : this.selectedKey();
  });
  focusedNode = computed(() => this.rows().find(row => row.node.key === this.focusedKey())?.node);

  protected ROW_HEIGHT_PX = ROW_HEIGHT_PX;

  constructor() {
    onResize(() => this.host, host => this.viewportHeight.set(host.clientHeight));
  }

  protected isExpanded = (node: TreeNode<T>) => !this.collapsedKeys().has(node.key!);

  protected onClick = (node: TreeNode<T>) => {
    this.focusedKeyState.set(node.key);
    this.activate(node);
  };

  protected onContextMenu = (node: TreeNode<T>, event: MouseEvent) => {
    event.preventDefault();
    this.focusedKeyState.set(node.key);
    this.nodeContextMenu.emit({node, event});
  };

  focusedRowElement = () => this.host.querySelector('.tree-list-row.focused');

  protected onKeydown = (event: KeyboardEvent) => {
    const rows = this.rows();
    const pageRows = Math.max(1, Math.floor(this.viewportHeight() / ROW_HEIGHT_PX) - 1);
    const action = treeKeyAction(rows, this.focusedKey(), event.key, pageRows, this.isExpanded);
    if (!action || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();

    if (action.focusKey) {
      this.focusedKeyState.set(action.focusKey);
      this.scrollRowIntoView(rows.findIndex(row => row.node.key === action.focusKey));
    }
    if (action.toggleKey) this.toggle({key: action.toggleKey});
    const focusedNode = this.focusedNode();
    if (action.activate && focusedNode) this.activate(focusedNode);
  };

  private activate = (node: TreeNode<T>) => {
    if (node.data) this.nodeSelect.emit(node);
    else this.toggle(node);
  };

  private scrollRowIntoView = (index: number) => {
    const spacer = this.host.querySelector<HTMLElement>('.tree-list-spacer');
    if (index < 0 || !spacer) return;
    const {scrollTop, clientHeight} = this.host;
    const rowTop = spacer.getBoundingClientRect().top - this.host.getBoundingClientRect().top + scrollTop + index * ROW_HEIGHT_PX;
    if (rowTop < scrollTop) this.host.scrollTop = rowTop;
    else if (rowTop + ROW_HEIGHT_PX > scrollTop + clientHeight) this.host.scrollTop = rowTop + ROW_HEIGHT_PX - clientHeight;
  };

  private toggle = ({key}: Pick<TreeNode<T>, 'key'>) => this.collapsedKeys.update(keys => {
    const toggled = new Set(keys);
    if (!toggled.delete(key!)) toggled.add(key!);
    return toggled;
  });
}
