/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * Window interface for the Tauri bridge (see src/app/api/tauri-bridge.ts).
 */

import type {editor} from 'monaco-editor';

export interface FoundProcess {
  pid: number;
  parentPid: number | null;
  name: string;
  cwd: string;
}

interface FsApi {
  readdir: (path: string) => Promise<string[]>;
  isFile: (path: string) => Promise<boolean>;
  writeFile: (path: string, data: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  readFileBytes: (path: string) => Promise<ArrayBuffer>;
  size: (path: string) => Promise<number>;
  exists: (path: string) => Promise<boolean>;
  mtime: (path: string) => Promise<number>;
}

interface PathApi {
  resolve: (...parts: string[]) => string;
  dirname: (path: string) => string;
}

export interface WatchOptions {
  recursive?: boolean;
  ignored?: unknown[];
}

interface ChokidarApi {
  watch: (id: string, paths: string | string[], options?: WatchOptions) => void;
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
  execFileBytes: (cmd: string, args: string[], options: ExecOptions) => Promise<ArrayBuffer>;
  spawnSync: (cmd: string, args: string[], options: SpawnOptions & {input?: string}) => Promise<SpawnSyncResult>;
  spawn: (cmd: string, args: string[], options: SpawnOptions) => Promise<string>;
  /** Running processes started as one of `names` (the program, or the script an interpreter runs), with their working directory */
  findProcesses: (names: string[]) => Promise<FoundProcess[]>;
  zoom: {
    setFactor: (factor: number) => void | Promise<void>;
    getFactor: () => number;
  };
  showItemInFolder: (fullPath: string) => void;
  openExternal: (url: string) => Promise<void>;
  /** Opens a file with the system's default application. Only paths under the temp dir's gitgud/ folder are allowed */
  openPath: (fullPath: string) => Promise<void>;
  tempDir: () => Promise<string>;
  appVersion: string;
  /** Short commit of a local / dev build, undefined for a tagged release */
  buildCommit?: string;
  packageFormat?: string;
  onWindowFocus: (cb: () => void) => unknown;
  offWindowFocus: (cb: () => void) => unknown;
  /** The main window, for the title bar the app draws itself */
  appWindow: {
    close: () => Promise<void>;
  };
  process: {
    platform: string;
    arch: string;
    env: Record<string, string>;
    versions?: Record<string, string>;
    argv?: string[];
  };
}

declare global {
  interface Window {
    tauri: TauriApi;
    /** The diff editor, exposed for e2e tests (window.monaco is not available in the main thread) */
    __e2eDiffEditor?: editor.IStandaloneDiffEditor;
  }
}
