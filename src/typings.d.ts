/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * Window interface for the Tauri bridge (see src/app/api/tauri-bridge.ts).
 */

import type {SpawnSyncReturns} from 'node:child_process';

interface FsApi {
  readdir: (path: string) => Promise<string[]>;
  isFile: (path: string) => Promise<boolean>;
  writeFile: (path: string, data: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  exists: (path: string) => Promise<boolean>;
  mtime: (path: string) => Promise<number>;
}

interface PathApi {
  resolve: (...parts: string[]) => string;
  dirname: (path: string) => string;
  extname: (path: string) => string;
}

interface ChokidarApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: (id: string, paths: string | string[], options?: Record<string, any>) => void;
  on: (id: string, event: string, cb: (...args: unknown[]) => void) => void;
  close: (id: string) => void;
}

interface SpawnSyncResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  maxBuffer?: number;
}

interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
}

interface TauriApi {
  fs: FsApi;
  path: PathApi;
  chokidar: ChokidarApi;
  crypto: { md5: (data: string) => Promise<string> };
  dialog: {
    showOpenDialog: (opts: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{name: string; extensions: string[]}>;
      properties?: string[];
    }) => Promise<string[] | null>;
  };
  execFile: (cmd: string, args: string[], options: ExecOptions) => Promise<{stdout: string; stderr: string}>;
  spawnSync: (cmd: string, args: string[], options: SpawnOptions & {input?: string}) => Promise<SpawnSyncResult>;
  spawn: (cmd: string, args: string[], options: SpawnOptions) => Promise<string>;
  zoom: {
    setFactor: (factor: number) => void | Promise<void>;
    getFactor: () => number;
  };
  showItemInFolder: (fullPath: string) => void;
  openExternal: (url: string) => Promise<void>;
  appVersion: string;
  packageFormat?: string;
  onWindowFocus: (cb: () => void) => unknown;
  offWindowFocus: (cb: () => void) => unknown;
  process: {
    platform: string;
    arch: string;
    execPath: string;
    env: Record<string, string>;
    versions?: Record<string, string>;
    argv?: string[];
  };
}

declare global {
  interface Window {
    tauri: TauriApi;
  }
}
