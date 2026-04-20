/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import type {PathLike, readdirSync, WriteFileOptions} from 'node:fs';
import type {dirname, extname, resolve} from 'node:path';
import type {dialog} from '@electron/remote';
import type {ChokidarOptions} from 'chokidar';
import type {ExecOptions, SpawnOptionsWithoutStdio, SpawnSyncOptions, spawnSync} from 'node:child_process';
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
      spawnSync: (cmd: string, args: string[], options: SpawnSyncOptions) => ReturnType<typeof spawnSync>;
      spawn:  (cmd: string, args: string[], options: SpawnOptionsWithoutStdio) => Promise<string>,

      zoom?: {
        setFactor: (factor: number) => void;
        getFactor: () => number;
      };

      onWindowFocus: (cb: () => void) => BrowserWindow;
      offWindowFocus: (cb: () => void) => BrowserWindow;
      process: NodeJS.Process;
    };
  }
}