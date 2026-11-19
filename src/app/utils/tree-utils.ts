import type {TreeNode} from 'primeng/api';
import type {WritableSignal} from '@angular/core';

export const toggleNode = <T>(nodes: WritableSignal<TreeNode<T>[]>, target: TreeNode<T>) =>
    nodes.set(toggle(nodes(), target));

function toggle<T>(nodes: TreeNode<T>[], target: TreeNode<T>): TreeNode<T>[] {
    return nodes.map(n => {
      if (n === target) return { ...n, expanded: !n.expanded };
      if (n.children?.length) return { ...n, children: toggle(n.children, target) };
      return n;
    });
  }

export const findNode = <T>(nodes: TreeNode<T>[], predicate: (data: T) => boolean): TreeNode<T> | undefined => {
  for (const node of nodes) {
    if (node.data && predicate(node.data)) return node;
    if (node.children) {
      const found = findNode(node.children, predicate);
      if (found) return found;
    }
  }
  return undefined;
};

/** The `selectionKeys` of a single-selection p-tree with this node selected (null would leave the tree's selection as it is) */
export const selectionKeysOf = (node?: TreeNode): Record<string, boolean> =>
  node?.key ? {[node.key]: true} : {};

// 'a/b/c' => ['a', 'a/b', 'a/b/c']
const toSubPaths = (path: string) => path.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/'));

/** Nests items in folders by the '/'-separated parts of their name */
export const toPathTree = <T>(items: T[], nameOf: (item: T) => string, leafNode: (item: T) => Partial<TreeNode<T>>): TreeNode<T>[] => {
  const nodeMap = new Map<string, TreeNode<T>>();
  const roots: TreeNode<T>[] = [];

  items.forEach(item => {
    const parts = toSubPaths(nameOf(item));

    parts.forEach((key, i) => {
      if (nodeMap.has(key)) return;

      const label = key.split('/').pop();
      const node: TreeNode<T> = i === parts.length - 1
        ? {key, label, data: item, leaf: true, expanded: true, selectable: true, ...leafNode(item)}
        : {key, label, icon: 'pi pi-folder', leaf: false, expanded: true, selectable: true, children: []};

      nodeMap.set(key, node);

      if (i === 0) {
        roots.push(node);
      } else {
        const parent = nodeMap.get(parts[i - 1])!;
        parent.children = [...(parent.children ?? []), node];
      }
    });
  });

  return roots;
};
