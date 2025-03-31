import {Branch, BranchType} from "../models/branch";
import {TreeNode} from "primeng/api";
import {uniqBy} from "lodash";

export const local = (branch: Branch) => branch.type == BranchType.Local;
export const remote = (branch: Branch) => branch.type == BranchType.Remote;

export const branchesToTree = (branches: Branch[]) =>
  uniqBy(branches.reduce((acc, b) => [...acc, branchToTreeNode(b, b.name, acc)], [] as TreeNode<Branch>[]), 'key');

const branchToTreeNode = (branch: Branch, subBranchName?: string, nodes: TreeNode<Branch>[] = []): TreeNode<Branch> => {

  subBranchName = subBranchName ?? branch.name;
  const subBranches = subBranchName.split('/');
  const parentBranchPart = subBranches[0];
  const isLeaf = subBranches?.length == 1;

  const branchNode = nodes.find(n => n.key == parentBranchPart) ?? {
    key: parentBranchPart,
    icon: isLeaf ? 'fa fa-code-fork' : 'pi pi-fw pi-folder',
    label: parentBranchPart,
    data: branch,
    leaf: isLeaf,
    expanded: true,
    selectable: isLeaf,
  };

  branchNode.children = isLeaf ? undefined : [...(branchNode.children ?? []), branchToTreeNode(branch, subBranches.slice(1).join('/'), nodes)];

  return branchNode;
};

/**
 * Remove the remote prefix from the string. If there is no prefix, returns
 * null. E.g.:
 *
 * origin/my-branch       -> my-branch
 * origin/thing/my-branch -> thing/my-branch
 * my-branch              -> null
 */
export const removeRemotePrefix = (name: string): string => name.match(/.*?\/(.*)/)![1]