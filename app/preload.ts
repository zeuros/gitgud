import {BrowserWindow, contextBridge} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {createHash} from 'crypto';
import {exec, execFile, ExecFileOptions} from 'child_process';
import {promisify} from 'util';
import {dialog, getCurrentWindow} from '@electron/remote';
import {ChokidarOptions, FSWatcher, watch} from 'chokidar';

const watchers = new Map<string, FSWatcher>();

contextBridge.exposeInMainWorld('electron', {
  fs: {
    readdirSync: fs.readdirSync.bind(fs),
    isFile: (f: string) => fs.statSync(f).isFile(),
  },

  path: {
    resolve: path.resolve.bind(path),
    dirname: path.dirname.bind(path),
    extname: path.extname.bind(path),
  },

  chokidar: {
    watch: (id: string, paths: string | string[], options?: ChokidarOptions) => {
      const watcher = watch(paths, options);
      watchers.set(id, watcher);
    },
    on: (id: string, event: string, cb: (...args: unknown[]) => void) => {
      watchers.get(id)?.on(event, cb);
    },
    close: (id: string) => {
      watchers.get(id)?.close();
      watchers.delete(id);
    },
  },

  crypto: {
    md5: (data: string) => createHash('md5').update(data).digest('hex'),
  },

  execFile: promisify(execFile) as (cmd: string, args: string[], options: ExecFileOptions) => Promise<{ stdout: string; stderr: string }>,

  openTerminal: (cwd: string, command?: string) => {
    if (process.platform === 'win32') {
      exec(`start cmd.exe /K "cd /d ${cwd}${command ? ' && ' + command : ''}"`, {cwd});
    } else if (process.platform === 'darwin') {
      exec(`osascript -e 'tell app "Terminal" to do script "cd ${cwd}${command ? ' && ' + command : ''}"'`);
    } else {
      exec(`x-terminal-emulator -e "bash -c 'cd ${cwd}${command ? ' && ' + command : ''}; exec bash'"`, {cwd});
    }
  },

  // dialog via @electron/remote
  dialog: {
    showOpenDialogSync: dialog.showOpenDialogSync.bind(dialog),
  },

  // Window events
  onWindowFocus: (cb: () => void): BrowserWindow => getCurrentWindow().on('focus', cb),
  offWindowFocus: (cb: () => void) => getCurrentWindow().off('focus', cb),

  processEnv: {...process.env},
});