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

/** indicate what a line in the diff represents */
export enum DiffLineType {
  Context,
  Add,
  Delete,
  Hunk,
}

/** track details related to each line in the diff */
export class DiffLine {
  public constructor(
    public readonly text: string,
    public readonly type: DiffLineType,
    // Line number in the original diff patch (before expanding it), or null if
    // it was added as part of a diff expansion action.
    public readonly originalLineNumber: number | null,
    public readonly oldLineNumber: number | null,
    public readonly newLineNumber: number | null,
    public readonly noTrailingNewLine: boolean = false
  ) {}

  public withNoTrailingNewLine(noTrailingNewLine: boolean): DiffLine {
    return new DiffLine(
      this.text,
      this.type,
      this.originalLineNumber,
      this.oldLineNumber,
      this.newLineNumber,
      noTrailingNewLine
    )
  }

  public isIncludeableLine() {
    return this.type === DiffLineType.Add || this.type === DiffLineType.Delete
  }

  /** The content of the line, i.e., without the line type marker. */
  public get content(): string {
    return this.text.substring(1)
  }

  public equals(other: DiffLine) {
    return (
      this.text === other.text &&
      this.type === other.type &&
      this.originalLineNumber === other.originalLineNumber &&
      this.oldLineNumber === other.oldLineNumber &&
      this.newLineNumber === other.newLineNumber &&
      this.noTrailingNewLine === other.noTrailingNewLine
    )
  }
}
