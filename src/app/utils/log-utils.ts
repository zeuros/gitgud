import {Branch} from '../lib/github-desktop/model/branch';
import {DisplayRef} from '../lib/github-desktop/model/display-ref';
import {Commit} from '../lib/github-desktop/model/commit';

export const formatArg = (fields: Object) => {
  const format = Object.values(fields).join('%x00');
  return `--format=${format}`;
};

export const byName = (branchName: string) => (branch: Branch) => branch.name == branchName;

export const bySha = (sha: string) => (c: DisplayRef) => c.sha === sha;

export const hasSameShas = (logsA: Commit[], logsB: Commit[]) => {
  const aShas = logsA.map(c => c.sha);
  return logsA.length == logsB.length && logsB.every(c => aShas.includes(c.sha));
};