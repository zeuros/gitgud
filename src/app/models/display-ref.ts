import {LogObject} from "./log-object";
import {RefType} from "../enums/ref-type.enum";
import {Branch} from "./branch";

export interface LogObjectDisplayInfo {
  refType: RefType,
  indent?: number,
  branchDetails?: { // Present only if commit pointed by branches
    branches: Branch[],
    local: boolean,
    remote: boolean,
    isPointedByLocalHead: boolean,
  }
}

// DisplayRef = LogObject (shared with Commit & Stash) = display data
export type DisplayRef = LogObject & LogObjectDisplayInfo;