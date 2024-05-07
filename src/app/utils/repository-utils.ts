import {GitRepository} from "../models/git-repository";
import {lastFolderName} from "./utils";

export const directoryToNewRepository = (directory: string): GitRepository => ({
    directory,
    name: lastFolderName(directory),
    sizes: [20, 50, 30],
    selected: true,
    localBranches: [],
});