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
