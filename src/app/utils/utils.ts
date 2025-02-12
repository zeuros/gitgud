import {TreeNode} from "primeng/api";
import {GitRepository} from "../models/git-repository";

export const lastFolderName = (f: string) => f.replace(/.*[\/\\]([^\\]+)[\/\\]/, '');

export const leaves = (treeNodes: TreeNode<string>[]): TreeNode<string>[] => treeNodes.flatMap(treeNode => treeNode.leaf ? [treeNode] : leaves(treeNode.children!));

export const findInLeaves = (treeNodes: TreeNode<string>[], filterFunction: (b: TreeNode<string>) => boolean) => leaves(treeNodes).find(filterFunction);

export const isRootDirectory = (path: string) => ['C:\\', '/'].includes(path);

export const throwEx = (message: string) => {
  console.log(new Error(message).toString());
  throw new Error(message);
}

export const errorMessage = (message: Error | string) => {
  if (message instanceof Error) return message.message; // avoids having 'Error: ...' which the Error class brings
  return message;
}

export const byPath = (path: string) => (repo: GitRepository) => path === repo.directory;