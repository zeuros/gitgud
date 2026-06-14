/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * Tauri bridge — implements the window.tauri interface using Tauri IPC.
 * Keeps API parity with the Electron preload so consumer code needs minimal changes.
 */

import {invoke} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {getVersion} from '@tauri-apps/api/app';
import {open as openDialog} from '@tauri-apps/plugin-dialog';
import {openUrl} from '@tauri-apps/plugin-opener';
import posixPath from './path-utils';

// ---------------------------------------------------------------------------
// Watcher registry — maps caller IDs to Tauri event unlisten functions
// ---------------------------------------------------------------------------
const watcherUnlisteners = new Map<string, Array<() => void>>();

// ---------------------------------------------------------------------------
// Assemble the bridge object
// ---------------------------------------------------------------------------
async function buildBridge() {
  // Kill any watchers left over from a previous JS session (e.g. after Ctrl+R).
  // Must run before any listen() calls so stale callback IDs stop receiving events.
  await invoke('close_all_watchers');

  const [version, platform, arch, execPath, env] = await Promise.all([
    getVersion(),
    invoke<string>('get_platform'),
    invoke<string>('get_arch'),
    invoke<string>('get_exec_path'),
    invoke<Record<string, string>>('get_env'),
  ]);

  const bridge = {
    fs: {
      readdir: (path: string) => invoke<string[]>('fs_readdir', {path}),
      isFile: (path: string) => invoke<boolean>('fs_is_file', {path}),
      writeFile: (path: string, data: string) => invoke<void>('fs_write_file', {path, data}),
      readFile: (path: string) => invoke<string>('fs_read_file', {path}),
      exists: (path: string) => invoke<boolean>('fs_exists', {path}),
      mtime: (path: string) => invoke<number>('fs_mtime', {path}),
    },

    path: {
      resolve: posixPath.resolve,
      dirname: posixPath.dirname,
      extname: posixPath.extname,
    },

    chokidar: {
      watch: (id: string, paths: string | string[], options?: Record<string, any>) => {
        const pathList = Array.isArray(paths) ? paths : [paths];
        // Rust handles its own base ignore list (.git, node_modules, etc.).
        // Only forward plain directory name strings — globs and regexes are not
        // understood by the Rust path-component filter.
        const ignoredDirs = Array.isArray(options?.ignored)
          ? (options.ignored as unknown[]).filter(
            (x): x is string => typeof x === 'string' && !x.includes('*') && !x.includes('/'),
          )
          : undefined;
        invoke('watch_paths', {
          id,
          paths: pathList,
          recursive: options?.recursive ?? true,
          ignoredDirs: ignoredDirs?.length ? ignoredDirs : undefined,
        }).catch(console.error);
      },
      on: (id: string, event: string, cb: (...args: unknown[]) => void) => {
        // Tauri emits 'watcher-event:{id}'; map to chokidar event names
        const safeId = id.replace(/[^a-zA-Z0-9\-/:_]/g, '_');
        listen<{ kind: string; paths: string[] }>(`watcher-event:${safeId}`, (tauriEvent) => {
          const payload = tauriEvent.payload;
          const paths: string[] = payload.paths ?? [];
          const kind = payload.kind?.toLowerCase() ?? '';

          if (event === 'all') {
            const chokidarEvent = kindToChokidar(kind);
            paths.forEach(p => cb(chokidarEvent, p));
          } else if (kindToChokidar(kind) === event) {
            paths.forEach(p => cb(p));
          }
        }).then((unlisten: () => void) => {
          const list = watcherUnlisteners.get(id) ?? [];
          list.push(unlisten);
          watcherUnlisteners.set(id, list);
        });
      },
      close: (id: string) => {
        invoke('close_watcher', {id}).catch(console.error);
        const unlisteners = watcherUnlisteners.get(id) ?? [];
        unlisteners.forEach(fn => fn());
        watcherUnlisteners.delete(id);
      },
    },

    crypto: {
      md5: (data: string) => invoke<string>('crypto_md5', {data}),
    },

    dialog: {
      showOpenDialog: async (opts: {
        title?: string;
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
        properties?: string[];
      }): Promise<string[] | null> => {
        const directory = opts.properties?.includes('openDirectory') ?? false;
        const result = await openDialog({
          title: opts.title,
          defaultPath: opts.defaultPath,
          filters: opts.filters,
          directory,
          multiple: opts.properties?.includes('multiSelections') ?? false,
        });
        if (!result) return null;
        return Array.isArray(result) ? result : [result as string];
      },
    },

    execFile: (cmd: string, args: string[], options: Record<string, unknown>) =>
      invoke<{ stdout: string; stderr: string }>('exec_file', {cmd, args, options}),

    spawnSync: (cmd: string, args: string[], options: Record<string, unknown>) =>
      invoke<{ stdout: string; stderr: string; status: number | null }>('spawn_sync_cmd', {cmd, args, options}),

    spawn: (cmd: string, args: string[], options: Record<string, unknown>) =>
      invoke<string>('spawn_cmd', {cmd, args, options}),

    zoom: {
      setFactor: (factor: number) => {
        // Persist the zoom factor; the settings service reads it back via getFactor
        localStorage.setItem('zoomFactor', String(factor));
        // Apply via CSS — Tauri doesn't expose a direct zoom/scale command
        document.body.style.setProperty('zoom', String(factor));
      },
      getFactor: (): number => {
        return parseFloat(localStorage.getItem('zoomFactor') ?? '1');
      },
    },

    showItemInFolder: (fullPath: string) => invoke('show_item_in_folder', {path: fullPath}).catch(console.error),

    openExternal: (url: string): Promise<void> => openUrl(url),

    appVersion: version,
    packageFormat: undefined as string | undefined,

    onWindowFocus: (cb: () => void) => {
      const win = getCurrentWindow();
      win.onFocusChanged(({payload: focused}: { payload: boolean }) => {
        if (focused) cb();
      }).then((unlisten: () => void) => {
        (cb as unknown as { _tauriUnlisten?: () => void })._tauriUnlisten = unlisten;
      });
      return win as unknown as Window;
    },

    offWindowFocus: (cb: () => void) => {
      const unlisten = (cb as unknown as { _tauriUnlisten?: () => void })._tauriUnlisten;
      if (unlisten) {
        unlisten();
        delete (cb as unknown as { _tauriUnlisten?: () => void })._tauriUnlisten;
      }
      return {} as unknown as Window;
    },

    process: {
      platform,
      arch,
      execPath,
      env,
      versions: {},
      argv: [],
    } as unknown as NodeJS.Process,
  };

  return bridge;
}

// Maps notify's EventKind debug strings (lowercased) to chokidar event names.
// notify serialises as e.g. "Modify(Data(Content))", "Create(File)", "Remove(Folder)".
function kindToChokidar(kind: string): string {
  if (kind.includes('create')) {
    return kind.includes('folder') ? 'addDir' : 'add';
  }
  if (kind.includes('remove')) {
    return kind.includes('folder') ? 'unlinkDir' : 'unlink';
  }
  // Modify(Name(...)) is a rename — treat as change; Modify(Data) is a content write
  if (kind.includes('modify')) return 'change';
  // Access(Close(Write)) is a real write; Access(Close(Read)) and plain reads are not.
  // Other/Unknown events are ignored — return a sentinel no listener will match.
  if (kind.includes('access')) return kind.includes('write') ? 'change' : '_ignore';
  return 'change';
}

export async function installTauriBridge(): Promise<void> {
  try {
    const bridge = await buildBridge();
    (window as unknown as { tauri: typeof bridge }).tauri = bridge;
    console.log('[tauri-bridge] bridge installed, platform:', bridge.process.platform);
  } catch (err) {
    console.error('[tauri-bridge] buildBridge failed:', err);
    throw err;
  }
}
