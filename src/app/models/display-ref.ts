import {LogObject} from "./log-object";
import {RefType} from "../enums/ref-type.enum";
import {Branch} from "./branch";

export interface LogObjectDisplayInfo {
  pointedByHead: boolean,
  refType: RefType,
  branchDetails?: { // Present only if commit pointed by branches
    branches: Branch[],
    local: boolean,
    remote: boolean,
    isPointedByLocalHead: boolean,
  }
  style?: {
    isRootCommit: boolean, // Beginning of a tree
    isMergeCommit: boolean, // A merge child is a child that ends a branch by merging it into another one.
    indent: number,
  }
}

// DisplayRef = LogObject (shared with Commit & Stash) = display data
export type DisplayRef = LogObject & LogObjectDisplayInfo;