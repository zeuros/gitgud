import {LogObject} from "./log-object";
import {RefType} from "../enums/ref-type.enum";
import {Branch} from "./branch";

export interface LogObjectDisplayInfo {
  refType: RefType,
  row?: number,
  indent?: number,
  isPointedByLocalHead: boolean, // If commit is pointed by HEAD, preselect the commit line, and add the 💻 icon
  highlight?: 'not-matched',
  branchesDetails: Branch[],
}

// DisplayRef = LogObject (shared with Commit & Stash) = display data
export type DisplayRef = LogObject & LogObjectDisplayInfo;