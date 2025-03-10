import {Commit} from "../models/commit";
import {DisplayRef} from "../models/display-ref";
import {RefType} from "../enums/ref-type.enum";


export type ChildrenMap = { [parentSha: string]: DisplayRef[] };


export const isMergeCommit = (displayRef: DisplayRef) => displayRef.refType == RefType.COMMIT && displayRef.parentSHAs.length > 1;
export const isRootCommit = (displayRef: DisplayRef | Commit) => displayRef.parentSHAs.length == 0

/**
 *                                                                                       (c)
 * True if the commit children have not splitted edges like (c) - (c) and not like (c) <
 *                                                                                       (c)
 */
export const hasNoBranching = (displayRef: DisplayRef | Commit, childMap: ChildrenMap): boolean => {
  const childrenCommits = childMap[displayRef.sha] ?? [];

  if (childrenCommits.length > 1) return false; // Found a branching (commit with 2+ children)

  if (childrenCommits.length == 0) return true; // We followed the commits till last one without finding branching

  return hasNoBranching(childrenCommits[0], childMap);
}

// Build the opposite of the Commit.parentShas => Commit.childShas
export const buildChildrenMap = (logs: DisplayRef[]) => {
  const commitsChildrenShas: ChildrenMap = {};

  for (const commit of logs) {
    for (const sha of commit.parentSHAs) {
      if (!commitsChildrenShas[sha])
        commitsChildrenShas[sha] = [];
      commitsChildrenShas[sha].push(commit);
    }
  }

  return commitsChildrenShas;
}
