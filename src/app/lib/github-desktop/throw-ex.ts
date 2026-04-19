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

import {throwEx} from "../../utils/utils";

/**
 * Unwrap a value that, according to the type system, could be null or
 * undefined, but which we know is not. If the value _is_ null or undefined,
 * this will throw. The message should contain the rationale for knowing the
 * value is defined.
 */
export const forceUnwrap = <T>(message: string, x: T | null | undefined): T => {
  if (x == null) {
    return throwEx(message)
  } else {
    return x
  }
}