import {type TreeNode} from 'primeng/api';

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
