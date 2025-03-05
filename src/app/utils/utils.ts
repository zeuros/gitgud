import {TreeNode} from "primeng/api";
import {GitRepository} from "../models/git-repository";
import {isUndefined, omitBy} from "lodash";
import {LogObject} from "../models/log-object";

export const lastFolderName = (f: string) => f.replace(/.*[\/\\]([^\\]+)[\/\\]/, '');

export const leaves = (treeNodes: TreeNode<string>[]): TreeNode<string>[] => treeNodes.flatMap(treeNode => treeNode.leaf ? [treeNode] : leaves(treeNode.children!));

export const isRootDirectory = (path: string) => ['C:\\', '/'].includes(path);

export const throwEx = (message: string) => {
  console.log(new Error(message).toString());
  throw new Error(message);
}

export const notZero = (n: number) => n == 0 ? 1 : n;

export const errorMessage = (message: Error | string) => {
  if (message instanceof Error) return message.message; // avoids having 'Error: ...' which the Error class brings
  return message;
}

export const byDirectory = (directory: string) => (repo: GitRepository) => directory === repo.directory;

export const byIndex = (repoIndex: number) => (_: GitRepository, i: number) => i === repoIndex;

// Compare LogObjects by date
export const byLogObjectDate = (o: LogObject, o2: LogObject) => o.author.date < o2.author.date ? 1 : -1

export const omitUndefined = <T extends object>(o: T | undefined) => {
  return omitBy<T>(o, isUndefined);
}

// Filters
export const removeDuplicates = <T>(item: T, index: number, array: T[]): boolean => array.indexOf(item) === index
export const notUndefined = <T>(v: T | undefined): v is T => !!v

// Reverse array AND start indexes from bottom !
export const reversedForEach = <T>(a: T[], callbackfn: (value: T, index: number, array: T[]) => void) =>
  a.slice().reverse().forEach((element: T, index: number, array: T[]) => callbackfn(element, a.length - 1 - index, array));
