import { TreeNode } from "primeng/api";

export const lastFolderName = (f: string) => f.replace(/.*[\/\\]([^\\]+)[\/\\]/, '');

export const leaves = (treeNodes: TreeNode<string>[]): TreeNode<string>[] => treeNodes.flatMap(treeNode => treeNode.leaf ? [treeNode] : leaves(treeNode.children!));

export const findInLeaves = (treeNodes: TreeNode<string>[], filterFunction: (b: TreeNode<string>) => boolean) => leaves(treeNodes).find(filterFunction);