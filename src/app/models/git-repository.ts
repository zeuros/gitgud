import {Commit} from "./commit";

export class GitRepository {
    constructor(
        public directory: string, // Identify the directory (like an id)
        public name: string,
        public sizes = [20, 50, 30], // panels sizes
        public selected = true, // currently selected
        public logs: Commit[] = [],
        // public branchesAndLogs: BranchesAndLogs = {},
        public currentBranch?: string,
        public remoteBranches: string[] = [],
        public remotes: { remote: string; url: string }[] = [],
    ) {
    }
}