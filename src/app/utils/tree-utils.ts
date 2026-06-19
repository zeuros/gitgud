import {type TreeNode} from 'primeng/api';
import {WritableSignal} from '@angular/core';

export const toggleNode = <T>(nodes: WritableSignal<TreeNode<T>[]>, target: TreeNode<T>) =>
    nodes.set(toggle(nodes(), target));

function toggle<T>(nodes: TreeNode<T>[], target: TreeNode<T>): TreeNode<T>[] {
    return nodes.map(n => {
      if (n === target) return { ...n, expanded: !n.expanded };
      if (n.children?.length) return { ...n, children: toggle(n.children, target) };
      return n;
    });
  }

export const findNode = <T>(nodes: TreeNode<T>[], predicate: (data: T) => boolean): TreeNode<T> | null => {
  for (const node of nodes) {
    if (node.data && predicate(node.data)) return node;
    if (node.children) {
      const found = findNode(node.children, predicate);
      if (found) return found;
    }
  }
  return null;
};
