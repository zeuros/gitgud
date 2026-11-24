import type {TreeNode} from 'primeng/api';

/** A node of a tree as listed, `depth` levels below the roots */
export interface TreeRow<T> {
  node: TreeNode<T>;
  depth: number;
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

/** The nodes in display order, skipping the children of collapsed nodes */
export const visibleRows = <T>(nodes: TreeNode<T>[], collapsedKeys: ReadonlySet<string>, depth = 0): TreeRow<T>[] =>
  nodes.flatMap(node => [
    {node, depth},
    ...(node.children?.length && !collapsedKeys.has(node.key!) ? visibleRows(node.children, collapsedKeys, depth + 1) : []),
  ]);

/** Rows [from, to) to render for a viewport scrolled to `scrollTop`, `overscanRows` more on each side */
export const rowsInView = (scrollTop: number, viewportHeight: number, rowHeight: number, overscanRows: number, rowCount: number) => ({
  from: Math.max(0, Math.floor(scrollTop / rowHeight) - overscanRows),
  to: Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscanRows),
});

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
        ? {key, label, data: item, ...leafNode(item)}
        : {key, label, icon: 'pi pi-folder', children: []};

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
