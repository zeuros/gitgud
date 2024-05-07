import {CommitObject} from "isomorphic-git";

export class GitRepository {
    constructor(
        public directory: string, // Identify the directory (like an id)
        public name: string,
        public sizes = [20, 50, 30], // panels sizes
        public selected = true, // currently selected
        public localBranches: string[] = [],
        public remoteBranches: string[] = [],
        public commits: CommitObject[] = [],
        public remotes: { remote: string; url: string }[] = [],
    ) {
    }
}