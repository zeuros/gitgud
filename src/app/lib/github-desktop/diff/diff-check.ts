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

import {map, Observable} from "rxjs";

/**
 * Returns a list of files with conflict markers present
 */
export function getFilesWithConflictMarkers(git: (args?: string[]) => Observable<string>) {
  return git(['diff', '--check'])
    .pipe(map(diff => {
      const files: Record<string, number> = {};
      const matches = diff.matchAll(/^(.+):\d+: leftover conflict marker/gm)

      for (const [, path] of matches)
        files[path] = (files[path] ?? 0) + 1;

      return files
    }))
}
