import {Branch} from "../lib/github-desktop/model/branch";
import {GitRepository} from "../models/git-repository";
import {DisplayRef} from "../lib/github-desktop/model/display-ref";

export const formatArg = (fields: Object) => {
  const format = Object.values(fields).join('%x00');
  return `--format=${format}`;
}

export const byName = (branchName: string) => (branch: Branch) => branch.name == branchName;

export const bySha = (sha: string) => (c: DisplayRef) => c.sha === sha;

export const logsAreEqual = (a: GitRepository, b: GitRepository) => hasSameShas(a.logs, b.logs) && hasSameShas(a.stashes, b.stashes);

const hasSameShas = (logsA: ReadonlyArray<{ sha: string }>, logsB: ReadonlyArray<{ sha: string }>) => {
  const aShas = logsA.map(c => c.sha);
  return logsA.length == logsB.length && logsB.every(c => aShas.includes(c.sha));
}