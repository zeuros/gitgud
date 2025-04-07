import {GitRepository} from "../models/git-repository";
import {lastFolderName} from "./utils";

// TODO: gather all repo infos to create the GitRepository object
export const createRepository = (directory: string) =>
  new GitRepository(directory, lastFolderName(directory));