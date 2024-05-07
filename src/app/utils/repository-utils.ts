import {GitRepository} from "../models/git-repository";
import {lastFolderName} from "./utils";

export const directoryToNewRepository = (directory: string) => new GitRepository(directory, lastFolderName(directory));