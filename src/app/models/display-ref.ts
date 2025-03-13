import {LogObject} from "./log-object";
import {RefType} from "../enums/ref-type.enum";
import {Branch} from "./branch";

export interface LogObjectDisplayInfo {
  refType: RefType,
  row?: number,
  indent?: number,
  isPointedByLocalHead: boolean, // If commit is pointed by HEAD, preselect the commit line, and add the 💻 icon
  branchesDetails: (Branch & { // Present only if commit pointed by branches
    local: boolean, // This commit is pointed by origin branch (starts with origin/). Shows the [gitHub] icon
    remote: boolean, // This commit is pointed by a local branch. Shows the 💻 icon
  })[]
}

// DisplayRef = LogObject (shared with Commit & Stash) = display data
export type DisplayRef = LogObject & LogObjectDisplayInfo;