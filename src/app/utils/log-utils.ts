import {Branch} from "../models/branch";
import {Commit} from "../models/commit";
import {DisplayRef} from "../models/display-ref";
import {CellContent, CellContents} from "../models/log-matrix";

export const formatArg = (fields: Object) => {
  const format = Object.values(fields).join('%x00');
  return `--format=${format}`;
}

export const byName = (branchName: string) => (branch: Branch) => branch.name == branchName;
export const bySha = (sha: string) => (commit: DisplayRef | Commit) => commit.sha == sha;
export const cellContainsCommit = (cell: CellContents) => cell.some(isDisplayRef); // Does this cell contains a commit ?
export const isDisplayRef = (toDraw: CellContent) => (toDraw as any)?.style?.indent != undefined;
