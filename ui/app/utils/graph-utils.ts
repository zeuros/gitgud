// A commit that tracks the branch it belongs to + infos to draw tree (relationships)


import {Commit} from "../../../src/models/commit";

export type CommitTreeCommit = Commit & {
  branch: string,
  drawCommitLine: string[], // Drawing for every column of this line. ex: ['∟', 'commit', '-', '', '|']
};
export type CommitTree = { [oid: string]: CommitTreeCommit };
