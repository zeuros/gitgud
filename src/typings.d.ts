import type {PathLike, readdirSync, WriteFileOptions} from 'node:fs';
import type {dirname, extname, resolve} from 'node:path';
import type {dialog} from '@electron/remote';
import type {ChokidarOptions} from 'chokidar';
import type {ExecOptions, SpawnOptionsWithoutStdio} from 'node:child_process';
import type {BrowserWindow} from 'electron';

export {};
declare global {
  interface Window {
    electron: {
      fs: {
        readdirSync: typeof readdirSync;
        isFile: (file: PathLike) => boolean;
        writeFileSync: (file: string, data: string, options?: WriteFileOptions) => void;
        readFileSync: (file: PathLike) => string;
        existsSync: (path: PathLike) => boolean;
        mtimeMs: (path: string) => number;
      };
      path: {
        resolve: typeof resolve;
        dirname: typeof dirname;
        extname: typeof extname;
      };
      chokidar: {
        watch: (id: string, paths: string | string[], options?: ChokidarOptions) => void;
        on: (id: string, event: string, cb: (...args: unknown[]) => void) => void;
        close: (id: string) => void;
      };
      crypto: {
        md5: (data: string) => string;
      };
      dialog: {
        showOpenDialogSync: typeof dialog.showOpenDialogSync;
      };

      execFile: (cmd: string, args: string[], options: ExecOptions) => Promise<{ stdout: string; stderr: string }>;
      spawn:  (cmd: string, args: string[], options: SpawnOptionsWithoutStdio) => Promise<string>,

      onWindowFocus: (cb: () => void) => BrowserWindow;
      offWindowFocus: (cb: () => void) => BrowserWindow;
      process: NodeJS.Process;
    };
  }
}