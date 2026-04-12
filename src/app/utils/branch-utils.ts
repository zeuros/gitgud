import {Branch, BranchType} from '../lib/github-desktop/model/branch';
import {TreeNode} from 'primeng/api';

export const local = (branch: Branch) => branch.type == BranchType.Local;
export const remote = (branch: Branch) => branch.type == BranchType.Remote;

// 'a/b/c' => ['a', 'a/b', 'a/b/c']
const toSubPaths = (path: string) => path.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/'));

export const toBranchTree = (branches: Branch[], branchNameTransform = (n: string) => n): TreeNode<Branch>[] => {
  const nodeMap = new Map<string, TreeNode<Branch>>();
  const roots: TreeNode<Branch>[] = [];

  branches.forEach(branch => {
    const parts = toSubPaths(branchNameTransform(branch.name));

    parts.forEach((key, i) => {
      if (nodeMap.has(key)) return;

      const isLeaf = i === parts.length - 1;
      const node: TreeNode<Branch> = isLeaf
        ? {
          key,
          icon: 'fa fa-code-fork',
          label: key.split('/').pop(),
          data: branch,
          leaf: true,
          expanded: true,
          selectable: true,
        }
        : {
          key,
          icon: 'pi pi-fw pi-folder',
          label: key.split('/').pop(),
          leaf: false,
          expanded: true,
          selectable: false,
          children: [],
        };

      nodeMap.set(key, node);

      if (i === 0) {
        roots.push(node);
      } else {
        const parentKey = parts[i - 1];
        const parent = nodeMap.get(parentKey)!;
        parent.children = [...(parent.children ?? []), node];
      }
    });
  });

  return roots;
};

export const removeRemotePrefix = (name: string): string => name.match(/.*?\/(.*)/)?.[1] ?? name;


export const findNode = (nodes: TreeNode<Branch>[], sha: string): TreeNode<Branch> | null => {
  for (const node of nodes) {
    if (node.data?.tip?.sha === sha) return node;
    if (node.children) {
      const found = findNode(node.children, sha);
      if (found) return found;
    }
  }
  return null;
};

// Normalize origin / local branch name origin/main → main
export const normalizedBranchName = (b: Branch) => b.name.replace('origin/', '')