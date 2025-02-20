import {Branch} from "../models/branch";

export const formatArg = (fields: Object) => {
  const format = Object.values(fields).join('%x00');
  return `--format=${format}`;
}

export const byName = (branchName: string) => (branch: Branch) => branch.name == branchName;