import {GitRepository} from "../models/git-repository";
import {lastFolderName} from "./utils";

export const createRepository = (directory: string) => {
  // TODO: gather all repo infos to create the GitRepository object
  return new GitRepository(directory, lastFolderName(directory));
}