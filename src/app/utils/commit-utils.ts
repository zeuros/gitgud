import {Commit} from "../models/commit";
import {DisplayRef} from "../models/display-ref";


export type CommitMap = { [sha: string]: Commit };
export type ChildrenMap = { [parentSha: string]: Commit[] };

/**
 *                                                                                       (c)
 * True if the commit children have not splitted edges like (c) - (c) and not like (c) <
 *                                                                                       (c)
 */
export const hasNoBranching = (displayRef: DisplayRef | Commit, childMap: { [sha: string]: Commit[] }): boolean => {
  const childrenCommits = childMap[displayRef.sha] ?? [];

  if (childrenCommits.length > 1) return false; // Found a branching (commit with 2+ children)

  if (childrenCommits.length == 0) return true; // We followed the commits till last one without finding branching

  return hasNoBranching(childrenCommits[0], childMap);
}

// Build the opposite of the Commit.parentShas => Commit.childShas
export const buildChildrenMap = (logs: ReadonlyArray<Commit>) => {
  const commitsChildrenShas: ChildrenMap = {};

  for (const commit of logs) {
    for (const sha of commit.parentSHAs) {
      commitsChildrenShas[sha] = commitsChildrenShas[sha]?.length
        ? [...commitsChildrenShas[sha], commit]
        : [commit];
    }
  }

  return commitsChildrenShas;
}

export const buildCommitMap = (logs: ReadonlyArray<Commit>) => {
  const commitMap: CommitMap = {};

  for (const commit of logs) {
    commitMap[commit.sha] = commit;
  }

  return commitMap;
}