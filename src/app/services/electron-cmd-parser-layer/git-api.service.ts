import {Injectable, isDevMode, signal} from '@angular/core';

// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting JavaScript file will look as if you never imported the module at all.
// import type {ExecOptions} from 'child_process';
import {defer, from, map, Observable, of, retry, switchMap, tap, throwError} from 'rxjs';
import {notUndefined, omitUndefined, showPerf} from '../../utils/utils';
import {ExecOptions, SpawnOptionsWithoutStdio} from 'node:child_process';

@Injectable({
  providedIn: 'root',
})
export class GitApiService {

  // When a repository is opened / loaded, set the cwd for future git commands
  readonly cwd = signal<string | undefined>(undefined);

  constructor() {
    // Notes :
    // * A NodeJS's dependency imported with 'window.require' MUST BE present in `dependencies` of both `app/package.json`
    // and `package.json (root folder)` in order to make it work here in Electron's Renderer process (src folder)
    // because it will be loaded at runtime by Electron.
    // * A NodeJS's dependency imported with TS module import (ex: import { Dropbox } from 'dropbox') CAN only be present
    // in `dependencies` of `package.json (root folder)` because it is loaded during build phase and does not need to be
    // in the final bundle. Reminder : only if not used in Electron's Main process (app folder)

    // If you want to use a NodeJS 3rd party deps in Renderer process,
    // ipcRenderer.invoke can serve many common use cases.
    // https://www.electronjs.org/docs/latest/api/ipc-renderer#ipcrendererinvokechannel-args

    this.git(['--version'])
      .pipe(map(version => `Git version: ${version}`))
      .subscribe(console.log);
  }

  git = (args: (string | undefined)[] | undefined, options?: ExecOptions) =>
    this.waitForLock().pipe(switchMap(() =>
      this.exec('git', args?.filter(notUndefined) ?? [], {cwd: this.cwd(), env: window.electron.process.env, ...options})));

  gitWithInput = (args: string[], input: string) =>
    this.waitForLock().pipe(map(() => {
      const result = window.electron.spawnSync('git', args, {cwd: this.cwd(), input, env: window.electron.process.env});
      if (result.status !== 0) throw new Error(`Git exited ${result.status}\n${result.stderr}`);
      return result.stdout;
    }));

  clone = (url: string, repoName: string, dir: string) =>
    this.cd(dir).pipe(
      switchMap(() => this.git(['clone', url, repoName])),
      tap(() => this.cwd.set(`${dir}/${repoName}`)),
    );


  cd = (dir: string) => this.exec('cd', [dir]).pipe(tap(() => this.cwd.set(dir)));

  exec = (cmd: string, args: string[] = [], options?: any) =>
    from(window.electron.execFile(`${cmd}`, args, omitUndefined({...options, stdio: 'inherit', maxBuffer: 10000000})))
      .pipe(
        map(({stdout}) => stdout.toString()),
        tap(isDevMode() ? showPerf(cmd, args) : () => 0),
      );

  spawn = (cmd: string, args: string[] = [], options?: SpawnOptionsWithoutStdio) =>
    this.waitForLock().pipe(switchMap(() => new Observable<string>(observer => {
      window.electron.spawn(`${cmd}`, args, {cwd: this.cwd(), env: window.electron.process.env, ...options})
        .then(out => {
          if (isDevMode()) showPerf(cmd, args, out);
          observer.next(out);
          observer.complete();
        })
        .catch(e => observer.error(e));
    })));

  /**
   * Guards against external git processes, but:
   * 1. The maxWaitMs / count duality is confusing — only one should drive the retry limit
   * 2. 700ms may time out prematurely for longer external operations
   */
  waitForLock = (maxWaitMs = 700, intervalMs = 100): Observable<void> => {
    const lockFile = `${this.cwd()}/.git/index.lock`;
    const start = Date.now();

    return defer(() => {
      if (!window.electron.fs.existsSync(lockFile)) return of(undefined);
      if (Date.now() - start > maxWaitMs) return throwError(() => new Error('Git lock timeout'));
      return throwError(() => new Error('Lock exists')); // triggers retry
    })
      .pipe(retry({delay: intervalMs, count: 10}));
  };

}
