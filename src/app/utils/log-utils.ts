import {Branch} from '../lib/github-desktop/model/branch';
import {DisplayRef} from '../lib/github-desktop/model/display-ref';
import {RefType} from '../enums/ref-type.enum';

export const formatArg = (fields: Object) => {
  const format = Object.values(fields).join('%x00');
  return `--format=${format}`;
};

export const byName = (branchName: string) => (branch: Branch) => branch.name == branchName;

export const bySha = (sha: string) => (c: DisplayRef) => c.sha === sha;

export const createIndexCommit = (parentCommit: DisplayRef) => ({
  summary: 'WIP',
  ref: parentCommit.ref,
  sha: 'index',
  parentSHAs: [parentCommit.sha] as string[],
  branchesDetails: [] as Branch[],
  refType: RefType.INDEX,
  isPointedByLocalHead: false,
  author: {},
  committer: {},
} as DisplayRef);
