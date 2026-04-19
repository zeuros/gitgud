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

import {RefType} from "../enums/ref-type.enum";

export class Edge {

  low: number;
  high: number;

  constructor(
    public childRow: number,
    public childCol: number,
    public parentRow: number,
    public parentCol: number,
    public type: RefType,
  ) {
    this.low = childRow;
    this.high = parentRow;
  }

}