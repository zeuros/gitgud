/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * Window interface for the Tauri bridge (see src/app/api/tauri-bridge.ts).
 */

import type {SpawnOptionsWithoutStdio} from 'node:child_process';
import type {editor} from 'monaco-editor';

/** What the agent view shows of a transcript line. A tool's result comes in a later line than the tool. */
export type TranscriptLineEntry =
  | {kind: 'prompt'; text: string}
  | {kind: 'text'; text: string}
  | {kind: 'tool'; id: string; name: string; summary: string}
  | {kind: 'result'; toolId: string; result: string; isError: boolean};

/** The lines of a transcript from a byte on */
/** A program running in a terminal GitGud draws */
export interface PtyInfo {
  pid: number;
  program: string;
  args: string[];
  cwd: string;
}

export interface PtyList {
  isAppStart: boolean;
  terminals: PtyInfo[];
}

export interface TranscriptChunk {
  entries: TranscriptLineEntry[];
  title: string | null;
  /** Where the next chunk starts: after the last complete line */
  nextByte: number;
  /** The file was shorter than the byte asked (rewritten): read from its start */
  restarted: boolean;
}

export interface FoundProcess {
  pid: number;
  parentPid: number | null;
  name: string;
  cwd: string;
  startTimeSecs: number;
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
  // Directory names skipped anywhere below the watched root, or only right below it when starting with '/'
  ignoredDirs?: string[];
  // Also skips what the repository's ignore rules exclude (.gitignore, info/exclude, global excludes), read when the watch starts
  respectGitIgnore?: boolean;
}

// Why a watch failed (watcher.rs). 'watch-limit': the OS limit of watched directories is reached (Linux inotify's
// fs.inotify.max_user_watches, shared by every app of the user), watchLimit being its value when known
export interface WatchError {
  kind: 'watch-limit' | 'other';
  message: string;
  watchLimit?: number | null;
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

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  maxBuffer?: number;
}

export type SpawnOptions = Pick<SpawnOptionsWithoutStdio, 'cwd' | 'env'>;

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
  /** The `names` found on PATH, in the given order */
  findPrograms: (names: string[]) => Promise<string[]>;
  /** Opens the user's terminal in `cwd`, running `program` */
  openInTerminal: (cwd: string, program: string) => Promise<void>;
  /** Claude Code's transcript at `path`, from `fromByte` on, up to its last complete line */
  readTranscript: (path: string, fromByte: number) => Promise<TranscriptChunk>;
  /** Programs running in a pseudo-terminal the page draws, by their pid */
  pty: {
    spawn: (program: string, args: string[], cwd: string, size: {cols: number; rows: number},
            onOutput: (data: ArrayBuffer) => void, onExit: (exitCode: number) => void) => Promise<number>;
    /** The programs running, kept across a page reload; `isAppStart` on the app's first page */
    list: () => Promise<PtyList>;
    /** Sends a running program's recent output to `onOutput`, then its output to come */
    attach: (pid: number, onOutput: (data: ArrayBuffer) => void, onExit: (exitCode: number) => void) => Promise<void>;
    write: (pid: number, data: string) => Promise<void>;
    resize: (pid: number, size: {cols: number; rows: number}) => Promise<void>;
    kill: (pid: number) => Promise<void>;
  };
  zoom: {
    setFactor: (factor: number) => void | Promise<void>;
    getFactor: () => number;
  };
  showItemInFolder: (fullPath: string) => Promise<void>;
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
  /** Files or folders dropped from the file manager onto the main window */
  onPathsDropped: (cb: (paths: string[]) => void) => void;
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
