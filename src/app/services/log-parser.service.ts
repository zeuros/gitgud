import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LogParserService {

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
  createLogParser = <T extends Record<string, string>>(fields: T) => {
    const keys: Array<keyof T> = Object.keys(fields)

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

    return parse;
  }
}
