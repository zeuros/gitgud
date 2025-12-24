import {GitRepository} from '../models/git-repository';
import {isUndefined, omitBy} from 'lodash';
import {BehaviorSubject} from 'rxjs';

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

export const byDirectory = (directory: string) => (repo: BehaviorSubject<GitRepository>) => directory === repo.value.directory;

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