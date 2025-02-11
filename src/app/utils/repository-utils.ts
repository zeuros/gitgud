import {GitRepository} from "../models/git-repository";
import {lastFolderName} from "./utils";
import {TreeNode} from "primeng/api";

export const directoryToNewRepository = (directory: string) => new GitRepository(directory, lastFolderName(directory));

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