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

/** What a key does in a tree: move the focus to a node, expand or collapse one, or activate (select / toggle) the focused one */
export interface TreeKeyAction {
  focusKey?: string;
  toggleKey?: string;
  activate?: boolean;
}

/**
 * The action of `key` (KeyboardEvent.key) with the focus on `focusedKey`, undefined for keys the tree leaves alone.
 * Up / Down / Page Up / Page Down / Home / End move the focus; Right expands a folder, then goes to its first child;
 * Left collapses a folder, else goes to the parent; Enter / Space activate. Without focus, a move starts from the first row.
 */
export const treeKeyAction = <T>(rows: TreeRow<T>[], focusedKey: string | undefined, key: string, pageRows: number, isExpanded: (node: TreeNode<T>) => boolean): TreeKeyAction | undefined => {
  const index = rows.findIndex(row => row.node.key === focusedKey);
  const focusAt = (i: number) => ({focusKey: rows[Math.max(0, Math.min(rows.length - 1, i))]?.node.key});
  if (index < 0) return ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(key) ? focusAt(0) : undefined;

  const {node, depth} = rows[index];
  const isFolder = !!node.children?.length;
  switch (key) {
    case 'ArrowUp': return focusAt(index - 1);
    case 'ArrowDown': return focusAt(index + 1);
    case 'PageUp': return focusAt(index - pageRows);
    case 'PageDown': return focusAt(index + pageRows);
    case 'Home': return focusAt(0);
    case 'End': return focusAt(rows.length - 1);
    case 'ArrowRight':
      if (!isFolder) return {};
      return isExpanded(node) ? focusAt(index + 1) : {toggleKey: node.key};
    case 'ArrowLeft': {
      if (isFolder && isExpanded(node)) return {toggleKey: node.key};
      const parent = rows.slice(0, index).reverse().find(row => row.depth === depth - 1);
      return parent ? {focusKey: parent.node.key} : {};
    }
    case 'Enter':
    case ' ': return {activate: true};
    default: return undefined;
  }
};

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
