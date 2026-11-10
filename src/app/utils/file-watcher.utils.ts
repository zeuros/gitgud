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

import type {WatchError, WatchOptions} from '../../typings';
import {fileName} from './utils';

export function createWatcher(id: string, paths: string | string[], options?: WatchOptions) {
  window.tauri.chokidar.watch(id, paths, options);

  const watcher = {
    on: (event: string, cb: (...args: unknown[]) => void) => {
      window.tauri.chokidar.on(id, event, cb);
      return watcher;
    },
    close: () => window.tauri.chokidar.close(id),
  };

  return watcher;
}

// What the user is told when a worktree's watch failed: what GitGud misses, and for the watch limit how to raise it
export const watchErrorMessage = (worktreePath: string, error: WatchError) => {
  const folderName = fileName(worktreePath) || worktreePath;
  const consequence = 'Until then, files changed outside GitGud show when its window regains focus, '
    + 'and git commands run elsewhere after your next action in GitGud.';
  if (error.kind === 'watch-limit') {
    const currentLimit = error.watchLimit ? ` (fs.inotify.max_user_watches = ${error.watchLimit})` : ' (fs.inotify.max_user_watches)';
    return `Can't watch every folder of ${folderName}: the system limit of watched folders${currentLimit}, `
      + `shared by all your apps, is reached. ${consequence} `
      + 'To raise it: sudo sysctl fs.inotify.max_user_watches=524288, then restart GitGud '
      + '(add fs.inotify.max_user_watches=524288 to a file in /etc/sysctl.d/ to keep it after a reboot).';
  }
  return `Can't watch the files of ${folderName}: ${error.message}. ${consequence}`;
};
