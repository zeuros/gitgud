import {GitRepository} from "../models/git-repository";
import {lastFolderName} from "./utils";
import {TreeNode} from "primeng/api";

export const createRepository = (directory: string) => {
  // TODO: gather all repo infos to create the GitRepository object
  return new GitRepository(directory, lastFolderName(directory));
}

export const branchToTreeNode = (branch: string, subBranch?: string): TreeNode<string> => {

  subBranch = subBranch ?? branch;
  const subBranches = subBranch.split('/');
  const parentBranchPart = subBranches[0];
  const isLeaf = subBranches?.length == 1;

  return {
    key: parentBranchPart,
    icon: isLeaf ? 'fa fa-code-fork' : 'pi pi-fw pi-folder',
    label: parentBranchPart,
    data: branch,
    leaf: isLeaf,
    expanded: true,
    selectable: isLeaf,
    children: isLeaf ? undefined : [branchToTreeNode(branch, subBranches.slice(1).join('/'))],
  } as TreeNode<string>;
};

/**
 * Remove the remote prefix from the string. If there is no prefix, returns
 * null. E.g.:
 *
 * origin/my-branch       -> my-branch
 * origin/thing/my-branch -> thing/my-branch
 * my-branch              -> null
 */
export const removeRemotePrefix = (name: string): string | null => {
  const pieces = name.match(/.*?\/(.*)/)
  if (!pieces || pieces.length < 2) {
    return null
  }

  return pieces[1]
}