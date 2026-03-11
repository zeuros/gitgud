import type {ChokidarOptions} from 'chokidar';

export function createWatcher(id: string, paths: string | string[], options?: ChokidarOptions) {
  window.electron.chokidar.watch(id, paths, options);

  const watcher = {
    on: (event: string, cb: (...args: unknown[]) => void) => {
      window.electron.chokidar.on(id, event, cb);
      return watcher;
    },
    close: () => window.electron.chokidar.close(id),
  };

  return watcher;
}