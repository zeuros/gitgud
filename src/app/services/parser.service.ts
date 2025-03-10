import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ParserService {

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
  createParser = <T extends Record<string, string>>(fields: T) => {

    const keys: Array<keyof T> = Object.keys(fields)

    return (value: string) => {
      const records = value.split('\0')
      const entries = []

      for (let i = 0; i < records.length - keys.length; i += keys.length) {
        const entry = {} as { [K in keyof T]: string }
        keys.forEach((key, ix) => (entry[key] = records[i + ix]))
        entries.push(entry)
      }

      return entries;
    }
  }

  createForEachRefParser = <T extends Record<string, string>>(fields: T) => {

    const keys: Array<keyof T> = Object.keys(fields)

    return (value: string) => {
      const records = ('%x00' + value.replace(/\n/g, '%x00\n%x00') + '%x00').split('%x00');
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
  }
}
