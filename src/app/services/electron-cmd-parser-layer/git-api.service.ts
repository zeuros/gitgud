import {Injectable, isDevMode, signal} from '@angular/core';

// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting JavaScript file will look as if you never imported the module at all.
// import type {ExecOptions} from 'child_process';
import {from, map, Observable, switchMap, tap} from 'rxjs';
import {notUndefined, omitUndefined, showPerf} from '../../utils/utils';

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

  git = (args: (string | undefined)[] | undefined) =>
    this.exec('git', args?.filter(notUndefined) ?? [], {cwd: this.cwd(), env: window.electron.processEnv});

  clone = (url: string, repoName: string, dir: string) =>
    this.cd(dir).pipe(
      switchMap(() => this.git(['clone', url, repoName])),
      tap(() => this.cwd.set(`${dir}/${repoName}`)),
    );


  cd = (dir: string) => this.exec('cd', [dir]).pipe(tap(() => this.cwd.set(dir)));

  exec = (cmd: string, args: string[] = [], options?: any): Observable<string> => {
    return from(window.electron.execFile(`${cmd}`, args, omitUndefined({...options, stdio: 'inherit', maxBuffer: 10000000})))
      .pipe(
        map(({stdout}) => stdout.toString()),
        tap(isDevMode() ? showPerf(cmd, args) : () => 0),
      );
  };

}
