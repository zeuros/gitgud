import {TreeNode} from "primeng/api";
import {GitRepository} from "../models/git-repository";
import {isUndefined, omitBy} from "lodash";
import {BehaviorSubject} from "rxjs";

export const lastFolderName = (f: string) => f.replace(/.*[\/\\]([^\\]+)[\/\\]/, '');

export const leaves = <T>(treeNodes: TreeNode<T>[]): TreeNode<T>[] => treeNodes.flatMap(treeNode => treeNode.leaf ? [treeNode] : leaves(treeNode.children!));

export const isRootDirectory = (path: string) => ['C:\\', '/'].includes(path);

// TODO: test
export const throwEx = (message: string) => {
  throw new Error(message);
}

export const errorMessage = (message: Error | string) => {
  if (message instanceof Error) return message.message; // avoids having 'Error: ...' which the Error class brings
  return message;
}

export const byDirectory = (directory: string) => (repo: BehaviorSubject<GitRepository>) => directory === repo.value.directory;

export const omitUndefined = <T extends object>(o: T | undefined) => {
  return omitBy<T>(o, isUndefined);
}

// Filters
export const removeDuplicates = <T>(item: T, index: number, array: T[]): boolean => array.indexOf(item) === index
export const notUndefined = <T>(v: T | undefined): v is T => !!v

// Reverse array AND start indexes from bottom !
export const reversedForEach = <T>(a: T[], callbackfn: (value: T, index: number, array: T[]) => void) =>
  a.slice().reverse().forEach((element: T, index: number, array: T[]) => callbackfn(element, a.length - 1 - index, array));
