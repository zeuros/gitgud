import {Injectable} from '@angular/core';

// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting javascript file will look as if you never imported the module at all.
import {ipcRenderer, webFrame} from 'electron';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as util from 'util';
import {from, map, Observable} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  ipcRenderer!: typeof ipcRenderer;
  webFrame!: typeof webFrame;
  childProcess!: typeof childProcess;
  fs!: typeof fs;
  util!: typeof util;
  promisedExec!: (cmd: string) => Promise<{ stdout: string, stderr: string }>;

  constructor() {
    // Conditional imports
    if (this.isElectron) {

      this.ipcRenderer = (window as any).require('electron').ipcRenderer;
      this.webFrame = (window as any).require('electron').webFrame;
      this.fs = (window as any).require('fs');
      this.childProcess = (window as any).require('child_process');
      this.util = (window as any).require('util');
      this.promisedExec = this.util.promisify(this.childProcess.exec);

      this.exec('node --version').subscribe(console.log);

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
    }
  }

  exec = (cmd: string, args: string[] = []) => from(this.promisedExec(`${cmd} ${args.join(' ')}`))
    .pipe(map(({stdout}) => stdout));

  get isElectron() {
    return !!window?.process?.type;
  }

  clone(comIsomorphicGitLightningFs: string, cTestRepo: string): Observable<void> {
    return new Observable<void>();
  }
}
