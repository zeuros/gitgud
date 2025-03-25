import {Branch} from "../models/branch";
import {GitRepository} from "../models/git-repository";

export const formatArg = (fields: Object) => {
  const format = Object.values(fields).join('%x00');
  return `--format=${format}`;
}

export const byName = (branchName: string) => (branch: Branch) => branch.name == branchName;

export const logsAreEqual = (a: GitRepository, b: GitRepository) => hasSameShas(a.logs, b.logs) && hasSameShas(a.stashes, b.stashes);

const hasSameShas = (logsA: ReadonlyArray<{ sha: string }>, logsB: ReadonlyArray<{ sha: string }>) => {
  const aShas = logsA.map(c => c.sha);
  return logsA.length == logsB.length && logsB.every(c => aShas.includes(c.sha));
}