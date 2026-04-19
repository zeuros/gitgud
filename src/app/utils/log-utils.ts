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

import {Branch} from '../lib/github-desktop/model/branch';
import {DisplayRef} from '../lib/github-desktop/model/display-ref';
import {RefType} from '../enums/ref-type.enum';

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
