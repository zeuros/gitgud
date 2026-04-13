import {BrowserWindow, contextBridge} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {createHash} from 'crypto';
import {execFile, ExecFileOptions} from 'child_process';
import {promisify} from 'util';
import {dialog, getCurrentWindow} from '@electron/remote';
import {ChokidarOptions, FSWatcher, watch} from 'chokidar';
import type {WriteFileOptions} from 'node:fs';
import {spawn, spawnSync, SpawnOptionsWithoutStdio, SpawnSyncOptions} from 'node:child_process';

const watchers = new Map<string, FSWatcher>();

contextBridge.exposeInMainWorld('electron', {
  fs: {
    readdirSync: fs.readdirSync.bind(fs),
    isFile: (f: string) => fs.statSync(f).isFile(),
    writeFileSync: (file: string, data: string, options: WriteFileOptions = {encoding: 'utf-8'}) => fs.writeFileSync(file, data, options),
    readFileSync: (f: string, encoding: BufferEncoding = 'utf-8') => fs.readFileSync(f, encoding).toString(),
    existsSync: fs.existsSync.bind(fs),
    mtimeMs: (f: string) => fs.statSync(f).mtimeMs,
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

  // Buffers all output in memory; do not use for large or streaming output
  execFile: promisify(execFile) as (cmd: string, args: string[], input: string, options: ExecFileOptions) => Promise<{ stdout: string; stderr: string }>,

  // Blocks the event loop until exit; only use for fast, short-lived commands
  spawnSync: (cmd: string, args: string[], options: SpawnSyncOptions)=> spawnSync(cmd, args, {...options, encoding: 'utf-8'}),

  // Streaming-safe; collects full output on exit — used to check file existence
  spawn: (cmd: string, args: string[], options: SpawnOptionsWithoutStdio): Promise<string> =>
    new Promise((resolve, reject) => {
      const child = spawn(cmd, args, options);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => stdout += data);
      child.stderr.on('data', (data) => stderr += data);

      child.on('close', (code) =>
        code === 0
          ? resolve(stdout + stderr)
          : reject(new Error(`Process exited with code ${code}\n${stderr}`)),
      );
      child.on('error', reject);
    }),

  // dialog via @electron/remote
  dialog: {
    showOpenDialogSync: dialog.showOpenDialogSync.bind(dialog),
  },

  // Window events
  onWindowFocus: (cb: () => void): BrowserWindow => getCurrentWindow().on('focus', cb),
  offWindowFocus: (cb: () => void) => getCurrentWindow().off('focus', cb),

  process: {...process},
});