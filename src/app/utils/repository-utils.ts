import {GitRepository} from "../models/git-repository";
import {lastFolderName} from "./utils";
import {TreeNode} from "primeng/api";
import {Branch} from "../models/branch";
import {Tree} from "primeng/tree";

export const createRepository = (directory: string) => {
  // TODO: gather all repo infos to create the GitRepository object
  return new GitRepository(directory, lastFolderName(directory));
}