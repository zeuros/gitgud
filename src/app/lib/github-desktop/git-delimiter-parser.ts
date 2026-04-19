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

/**
 * Create a new parser suitable for parsing --format output from commands such
 * as `git log`, `git stash`, and other commands that are not derived from
 * `ref-filter`.
 *
 * Returns an object with the arguments that need to be appended to the git
 * call and the parse function itself
 *
 * @param fields An object keyed on the friendly name of the value being
 *               parsed with the value being the format string of said value.
 *
 *               Example:
 *
 *               `const { args, parse } = createLogParser({ sha: '%H' })`
 */
export function createLogParser<T extends Record<string, string>>(fields: T) {
  const keys: Array<keyof T> = Object.keys(fields)
  const format = Object.values(fields).join('%x00')
  const formatArgs = ['-z', `--format=${format}`]

  const parse = (value: string) => {
    const records = value.split('\0')
    const entries = []

    for (let i = 0; i < records.length - keys.length; i += keys.length) {
      const entry = {} as { [K in keyof T]: string }
      keys.forEach((key, ix) => (entry[key] = records[i + ix]))
      entries.push(entry)
    }

    return entries
  }

  return { formatArgs, parse }
}

/**
 * Create a new parser suitable for parsing --format output from commands such
 * as `git for-each-ref`, `git branch`, and other commands that are not derived
 * from `git log`.
 *
 * Returns an object with the arguments that need to be appended to the git
 * call and the parse function itself
 *
 * @param fields An object keyed on the friendly name of the value being
 *               parsed with the value being the format string of said value.
 *
 *               Example:
 *
 *               `const { args, parse } = createForEachRefParser({ sha: '%(objectname)' })`
 */
export function createForEachRefParser<T extends Record<string, string>>(
  fields: T
) {
  const keys: Array<keyof T> = Object.keys(fields)
  const format = Object.values(fields).join('%00')
  const formatArgs = [`--format=%00${format}%00`]

  const parse = (value: string) => {
    const records = value.split('\0')
    const entries = new Array<{ [K in keyof T]: string }>()

    let entry
    let consumed = 0

    // start at 1 to avoid 0 modulo X problem. The first record is guaranteed
    // to be empty anyway (due to %00 at the start of --format)
    for (let i = 1; i < records.length - 1; i++) {
      if (i % (keys.length + 1) === 0) {
        if (records[i] !== '\n') {
          throw new Error('Expected newline')
        }
        continue
      }

      entry = entry ?? ({} as { [K in keyof T]: string })
      const key = keys[consumed % keys.length]
      entry[key] = records[i]
      consumed++

      if (consumed % keys.length === 0) {
        entries.push(entry)
        entry = undefined
      }
    }

    return entries
  }

  return { formatArgs, parse }
}
