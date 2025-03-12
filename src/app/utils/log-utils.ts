import {Branch} from "../models/branch";
import {DisplayRef} from "../models/display-ref";

export const formatArg = (fields: Object) => {
  const format = Object.values(fields).join('%x00');
  return `--format=${format}`;
}

export const byName = (branchName: string) => (branch: Branch) => branch.name == branchName;
export const bySha = (sha: string) => (commit: DisplayRef) => commit.sha == sha;