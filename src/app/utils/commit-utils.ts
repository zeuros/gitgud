import {Commit} from "../lib/github-desktop/model/commit";
import {DisplayRef} from "../lib/github-desktop/model/display-ref";
import {RefType} from "../enums/ref-type.enum";
import {CommitIdentity} from "../lib/github-desktop/model/commit-identity";


export type ChildrenMap = { [parentSha: string]: DisplayRef[] };
export type ShaMap = { [sha: string]: DisplayRef };


export const isCommit = (displayRef: DisplayRef) => displayRef.refType == RefType.COMMIT;
export const isIndex = (displayRef: DisplayRef) => displayRef.refType == RefType.INDEX;
export const isStash = (displayRef: DisplayRef) => displayRef.refType == RefType.STASH;
export const isMergeCommit = (displayRef: DisplayRef) => isCommit(displayRef) && displayRef.parentSHAs.length > 1;
export const isRootCommit = (displayRef: DisplayRef | Commit) => displayRef.parentSHAs.length == 0

export const initials = (author: CommitIdentity) => author.name.split(' ').slice(0, 2).map(e => e[0]).join('').toUpperCase();
export const hasName = (author: CommitIdentity) => author.name.length > 0;
export const commitColor = (indent: number) => `hue-rotate(${indent * 360 / 7}deg)`;

// TODO move somewhere
export const edgeType = (childCommit: DisplayRef) => {
  if (childCommit.refType == RefType.INDEX) return RefType.INDEX;
  else if (isMergeCommit(childCommit)) return RefType.MERGE_COMMIT;
  else return RefType.COMMIT;
}

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

export const hasChild = (stash: DisplayRef, childrenMap: ChildrenMap) => !!childrenMap[stash.sha];

export const stashParentCommitSha = (stash: DisplayRef, shaMap: ShaMap) => stash.parentSHAs.find(parentSha => isCommit(shaMap[parentSha]))!;

// Build the opposite of the Commit.parentShas => Commit.childShas
export const buildChildrenMap = (commitLog: DisplayRef[]) => {
  const commitsChildrenShas: ChildrenMap = {};

  for (const commit of commitLog) {
    for (const sha of commit.parentSHAs) {
      if (!commitsChildrenShas[sha])
        commitsChildrenShas[sha] = [];
      commitsChildrenShas[sha].push(commit);
    }
  }

  return commitsChildrenShas;
}

export const buildShaMap = (logs: DisplayRef[]) => {
  const commitMap: ShaMap = {};

  for (const commit of logs) {
    commitMap[commit.sha] = commit;
  }

  return commitMap;
}