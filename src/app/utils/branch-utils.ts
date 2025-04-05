import {Branch, BranchType} from "../models/branch";
import {TreeNode} from "primeng/api";

export const local = (branch: Branch) => branch.type == BranchType.Local;
export const remote = (branch: Branch) => branch.type == BranchType.Remote;

const byKey = (key: string) => (treeNode: TreeNode<Branch>) => treeNode.key == key;

// 'a/b/c' => ['a', 'a/b', 'a/b/c']
const toSubPaths = (path: string) => path.split("/").map((_, i) => path.split("/").slice(0, i + 1).join("/"));

const allNodes = (rootNodes: TreeNode<Branch>[]): TreeNode<Branch>[] =>
  [...rootNodes, ...rootNodes.flatMap(node => allNodes(node.children ?? []))];

export const toBranchTree = (branches: Branch[], branchNameTransform?: (n: string) => string) => {
  const nodes: TreeNode<Branch>[] = [];
  branches.forEach(b => addBranchToTree(b, nodes, branchNameTransform));
  return nodes;
}

// Add branch as branch in tree (heh)
export const addBranchToTree = (branch: Branch, rootNodes: TreeNode<Branch>[], branchNameTransform = (n: string) => n) => {

  const allTreeNodes = allNodes(rootNodes);

  const parts = [
    ...toSubPaths(branchNameTransform(branch.name)).slice(0, -1).map(key => allTreeNodes.find(byKey(key)) ?? pathBitToTreeNode(key)),
    branchToTreeNode(branch)
  ];

  parts.forEach((part, i) => {
    if (i < parts.length - 1 && !part.children?.some(c => c.key == parts[i + 1].key))
      part.children = [...(part.children ?? []), parts[i + 1]];
  });

  // Only add root nodes (if not duplicate)
  if (!rootNodes.find(byKey(parts[0].key!)))
    rootNodes.push(parts[0]);
}

const pathBitToTreeNode = (pathBit: string): TreeNode<Branch> => ({
  key: pathBit,
  icon: 'pi pi-fw pi-folder',
  label: pathBit.split('/').pop(),
  leaf: false,
  expanded: true,
  selectable: false,
});


const branchToTreeNode = (branch: Branch): TreeNode<Branch> => ({
  key: branch.name,
  icon: 'fa fa-code-fork',
  label: branch.name.split('/').pop(),
  data: branch,
  leaf: true,
  expanded: true,
  selectable: true,
});

/**
 * Remove the remote prefix from the string. If there is no prefix, returns
 * null. E.g.:
 *
 * origin/my-branch       -> my-branch
 * origin/thing/my-branch -> thing/my-branch
 * my-branch              -> null
 */
export const removeRemotePrefix = (name: string): string => name.match(/.*?\/(.*)/)![1]
