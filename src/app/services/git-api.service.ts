import {Injectable} from '@angular/core';

// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting javascript file will look as if you never imported the module at all.

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import {from, map, Observable} from "rxjs";
import {isRootDirectory, throwEx} from "../utils/utils";
import * as electron from "@electron/remote";

/**
 * This service helps manipulate git through @electron/remote
 */
@Injectable({
  providedIn: 'root'
})
export class GitApiService {

  electron: typeof electron = (window as any).require('@electron/remote')
  dialog = this.electron.dialog;
  childProcess: typeof childProcess = (window as any).require('child_process');
  fs: typeof fs = (window as any).require('fs');
  path: typeof path = (window as any).require('path');
  util: typeof util = (window as any).require('util');
  promisedExec: (cmd: string) => Promise<{ stdout: string, stderr: string }> = this.util.promisify(this.childProcess.exec);

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

    // Sample code to exec anything on machine (safe ?)
    this.exec('node --version')
      .pipe(map(version => `Node version: ${version}`))
      .subscribe(console.log);
  }

  exec = (cmd: string, args: string[] = []) => from(this.promisedExec(`${cmd} ${args.join(' ')}`))
    .pipe(map(({stdout}) => stdout));

  get isElectron() {
    return !!window?.process?.type;
  }

  clone = (comIsomorphicGitLightningFs: string, cTestRepo: string): Observable<void> => {
    // TODO
    return new Observable<void>();
  }


  pickGitFolder = () => {

    const pickedGitFolder = (this.dialog.showOpenDialogSync({properties: ['openDirectory']}) ?? throwEx('No folder selected'))[0];

    return this.findGitDir(pickedGitFolder);

  }

  /**
   * Lookup in parent folder, and check if path corresponds to a git repo
   */
  findGitDir = (gitDir: string): string => {

    if (this.fs.statSync(gitDir).isFile())
      return this.findGitDir(this.path.dirname(gitDir));

    const files = this.fs.readdirSync(gitDir);
    if (files.includes('.git'))
      return gitDir;
    else if (isRootDirectory(gitDir))
      return throwEx(`This folder is not a valid git repository`);
    else
      return this.findGitDir(this.path.resolve(gitDir, '..'))

  }

}
