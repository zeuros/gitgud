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

import {LogObject} from "../../../models/log-object";
import {RefType} from "../../../enums/ref-type.enum";
import {Branch} from "./branch";

export interface LogObjectDisplayInfo {
  refType: RefType,
  row?: number,
  indent?: number,
  isPointedByLocalHead: boolean, // If commit is pointed by HEAD, preselect the commit line, and add the 💻 icon
  highlight?: 'not-matched' | 'conflict',
  branchesDetails: Branch[],
}

// DisplayRef = LogObject (shared with Commit & Stash) = display data
export type DisplayRef = LogObject & LogObjectDisplayInfo;