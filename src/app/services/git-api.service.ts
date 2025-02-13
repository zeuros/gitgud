import {Injectable} from '@angular/core';

// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting javascript file will look as if you never imported the module at all.
import * as childProcess from 'child_process';
import {ExecOptions} from 'child_process';
import * as util from 'util';
import {from, map, Observable} from "rxjs";
import {omitUndefined} from "../utils/utils";
import * as electron from "@electron/remote";
import * as path from 'path';

/**
 * This service helps manipulate git through @electron/remote
 */
@Injectable({
  providedIn: 'root'
})
export class GitApiService {

  childProcess: typeof childProcess = (window as any).require('child_process');
  util: typeof util = (window as any).require('util');
  electron: typeof electron = (window as any).require('@electron/remote')
  promisedExec = this.util.promisify(this.childProcess.execFile);
  path: typeof path = (window as any).require('path');

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

  /**
   * @param args
   * @param cwd Which folder to execute git from
   */
  git = (args: string[] = [], cwd?: string) =>
    this.exec('git', args, {cwd, env: process.env});


  get isElectron() {
    return !!window?.process?.type;
  }

  clone = (comIsomorphicGitLightningFs: string, cTestRepo: string): Observable<void> => {
    // TODO
    return new Observable<void>();
  }

  exec = (cmd: string, args: string[] = [], options?: ExecOptions) =>
    from(this.promisedExec(`${cmd}`, args, omitUndefined({...options, stdio: 'inherit'})))
      .pipe(map(({stdout}) => stdout));


}
