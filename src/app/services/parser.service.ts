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

// Maps the caller's field name object to a typed record with the same keys, all string values.
type ParseResult<T extends Record<string, string>> = { [K in keyof T]: string };

// Bundles the --format arg string and its matching parser
interface GitParser<T extends Record<string, string>> {
  formatArg: string;
  parse: (output: string) => ParseResult<T>[];
}

// Joins all git format specifiers with NUL (%x00) as the field separator.
// e.g. fields = { sha: '%H', summary: '%s' } → '--format=%H%x00%s'
const buildFormatArg = <T extends Record<string, string>>(fields: T): string =>
  `--format=${Object.values(fields).join('%x00')}`;

// Parser for `git log -z` / `git stash list -z`.
//
// Wire format: each record is a flat sequence of NUL-separated field values,
// and -z appends one extra NUL after the last field of each record:
//   sha\0summary\0body\0...\0sha\0summary\0body\0...
//
// Strategy: split on \0, drop only the trailing '' left by the final -z delimiter,
// then slice every n elements into one typed record.
// Empty fields (e.g. %b on a commit with no body) MUST NOT be filtered — doing so
// shifts every subsequent field and causes wrong values to be mapped to wrong keys.
export const createLogParser = <T extends Record<string, string>>(fields: T): GitParser<T> => {
  const keys = Object.keys(fields) as (keyof T)[];
  const n = keys.length;
  return {
    formatArg: buildFormatArg(fields),
    parse: (gitOutput: string) => {
      const parts = gitOutput.split('\0');
      if (parts.at(-1) === '') parts.pop(); // only the -z trailing delimiter, not empty field values
      const entries: ParseResult<T>[] = [];
      for (let i = 0; i + n <= parts.length; i += n)
        entries.push(Object.fromEntries(keys.map((k, j) => [k, parts[i + j]])) as ParseResult<T>);
      return entries;
    },
  };
};

// Parser for `git for-each-ref`.
//
// Wire format: one record per line, fields separated by the literal string '%x00'
// (for-each-ref does not interpret %x00 as NUL in its output — it writes the 4-char escape).
//   refs/heads/main%x00abc123%x00...
//   refs/heads/dev%x00def456%x00...
export const createForEachRefParser = <T extends Record<string, string>>(fields: T): GitParser<T> => {
  const keys = Object.keys(fields) as (keyof T)[];
  return {
    formatArg: buildFormatArg(fields),
    parse: (gitOutput: string) =>
      gitOutput.split('\n')
        .filter(line => line.trim())
        .map(line => Object.fromEntries(
          keys.map((k, i) => [k, line.split('%x00')[i] ?? ''])
        ) as ParseResult<T>),
  };
};
