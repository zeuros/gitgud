/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {isUndefined, omitBy} from 'lodash-es';
import {Commit} from '../lib/github-desktop/model/commit';
import {Branch} from '../lib/github-desktop/model/branch';

import {WorkDirStatus, WorkingDirectoryFileChange} from '../lib/github-desktop/model/workdir';

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
export const keyComparison = (a?: object, b?: object) => !!a && !!b && shallowArrayEqual(Object.keys(a), Object.keys(b));
export const shallowArrayEqual = <T>(a?: T[], b?: T[]) => a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]));