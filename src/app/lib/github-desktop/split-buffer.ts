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

export function splitBuffer(buffer: Buffer, delimiter: string): Buffer[] {
  const result = []
  let start = 0
  let index = buffer.indexOf(delimiter, start)
  while (index !== -1) {
    result.push(buffer.subarray(start, index))
    start = index + delimiter.length
    index = buffer.indexOf(delimiter, start)
  }
  if (start < buffer.length) {
    result.push(buffer.subarray(start))
  }
  return result
}
