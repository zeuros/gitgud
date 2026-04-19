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

export class GitAuthor {
  static parse(nameAddr: string): GitAuthor | null {
    const m = nameAddr.match(/^(.*?)\s+<(.*?)>/)
    return m === null ? null : new GitAuthor(m[1], m[2])
  }

  constructor(
    public readonly name: string,
    public readonly email: string
  ) {
  }

  toString() {
    return `${this.name} <${this.email}>`
  }
}
