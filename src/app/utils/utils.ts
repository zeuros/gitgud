import {isUndefined, omitBy} from 'lodash-es';
import {WorkDirStatus} from '../lib/github-desktop/commit-files-changes';
import {Commit} from '../lib/github-desktop/model/commit';
import {Branch} from '../lib/github-desktop/model/branch';
import {WorkingDirectoryFileChange} from '../lib/github-desktop/model/status';

export const lastFolderName = (f: string) => f.replace(/.*[\/\\]([^\\]+)[\/\\]/, '');

export const isRootDirectory = (path: string) => ['C:\\', '/'].includes(path);

// TODO: test
export const throwEx = (message: string): never => {
  throw new Error(message);
};

export const errorMessage = (message: Error | string) => {
  if (message instanceof Error) return message.message; // avoids having 'Error: ...' which the Error class brings
  return message;
};

// Filter out undefined values from an object
export const omitUndefined = <T extends object>(o: T | undefined) => omitBy<T>(o, isUndefined);

// Filters
export const removeDuplicates = <T>(item: T, index: number, array: T[]): boolean => array.indexOf(item) === index;
export const notUndefined = <T>(v: T | undefined | null): v is T => !!v;
// ts's instanceof doesn't work for some reason (not across module boundaries?)
export const instanceOf = <T extends new (...args: any[]) => any>(o: any, theClassType: T): o is InstanceType<T> =>
  o?.constructor?.name === theClassType.name;


export const directory = (path: string) => path.split('/').slice(0, -1).join('/');
export const fileName = (path: string) => path.split('/').pop();

export const showPerf = (cmd: string, args: string[] = [], out?: any) => {
  const start = performance.now();
  return () => console.warn(`${cmd} ${args.join(' ')} (${performance.now() - start}ms)`, out);
};

export const workingDirHasChanges = (status?: WorkDirStatus) => (status?.unstaged.length ?? 0) > 0 || (status?.staged.length ?? 0) > 0;

// Signals diff comparators
export const logsComparison = (a: Commit[], b: Commit[]) => a.length === b.length && a.every((c, i) => c.sha === b[i].sha);
export const branchesComparison = (a: Branch[], b: Branch[]) => a.length === b.length && a.every((b1, i) => b1.name === b[i]?.name);
export const shallowArrayEqual = <T>(a?: T[], b?: T[]) => a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]));
export const workDirComparison = (a?: WorkDirStatus, b?: WorkDirStatus) => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.staged.length !== b.staged.length || a.unstaged.length !== b.unstaged.length) return false;
  return a.staged.every((f, i) => workDirFileChangeKey(f) === workDirFileChangeKey(b.staged[i]))
      && a.unstaged.every((f, i) => workDirFileChangeKey(f) === workDirFileChangeKey(b.unstaged[i]));
};

const workDirFileChangeKey = (f: WorkingDirectoryFileChange) => `${f.path}:${f.status}`;
