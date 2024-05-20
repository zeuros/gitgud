import {ReadCommitResult} from "isomorphic-git";
import {BranchesAndLogs} from "../services/electron-ipc-api.service";

export class GitRepository {
    constructor(
        public directory: string, // Identify the directory (like an id)
        public name: string,
        public sizes = [20, 50, 30], // panels sizes
        public selected = true, // currently selected
        public branchesAndLogs: BranchesAndLogs = {},
        public remoteBranches: string[] = [],
        public remotes: { remote: string; url: string }[] = [],
    ) {
    }
}