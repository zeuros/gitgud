# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start                       # dev: Angular dev server + Tauri shell (tauri dev)
npm test                        # run unit tests (vitest, node environment)
npm run tauri:build             # production build + native installer (current platform)
npm run tauri:build:linux-deb   # .deb package
npm run tauri:build:linux-rpm   # .rpm package
npm run e2e                     # playwright e2e (needs xvfb on headless)
```

Single test file: `npx vitest run src/path/to/file.spec.ts`

Cargo (from `src-tauri/`): `cargo check`, `cargo clippy`, `cargo build`

## Stack

Tauri 2 + Angular 21 + Monaco Editor. The Electron code (`app/main.ts`, `app/preload.ts`) is the old implementation — **do not touch it**. All active development is in `src-tauri/` (Rust backend) and `src/app/api/tauri-bridge.ts` (JS bridge). UI uses PrimeNG components and Angular Signals throughout.

## Architecture

### The Tauri IPC bridge (`src/app/api/tauri-bridge.ts` → `src/typings.d.ts`)

`tauri-bridge.ts` implements `window.electron` using Tauri IPC (`@tauri-apps/api/core` `invoke` + `listen`). It keeps API parity with the old Electron preload so all consumer services work unchanged. The TypeScript interface is declared in `src/typings.d.ts` as `ElectronApi`.

On startup `buildBridge()` runs, kills any stale watchers (`close_all_watchers`), reads platform/arch/env via parallel IPC calls, and installs the bridge at `window.electron`.

**Rust commands** live in `src-tauri/src/commands/` and are registered in `src-tauri/src/lib.rs`:

| Module | Commands |
|--------|---------|
| `fs.rs` | `fs_readdir`, `fs_is_file`, `fs_write_file`, `fs_read_file`, `fs_exists`, `fs_mtime` |
| `process.rs` | `exec_file`, `spawn_sync_cmd`, `spawn_cmd` |
| `watcher.rs` | `watch_paths`, `close_watcher`, `close_all_watchers` |
| `util.rs` | `crypto_md5`, `get_env`, `get_platform`, `get_arch`, `get_exec_path`, `show_item_in_folder`, `path_resolve`, `path_dirname`, `path_extname` |

### Git execution layer

`GitApiService` (`src/app/services/electron-cmd-parser-layer/git-api.service.ts`) is the sole entry point for running git. It calls `window.electron.execFile`, which routes to the Rust `exec_file` command backed by `ShellPoolManager` (`src-tauri/src/shell_pool.rs`) — a pool of 6 persistent bash processes per repo path. This eliminates per-call `fork()+execve()` overhead (~30ms each).

- `git()` — read operations, used by reader services
- `gitAction()` — user-triggered mutations (commit, rebase, push…), also records to history
- `waitForLock()` — checks `.git/index.lock` before every call

Reader services (`electron-cmd-parser-layer/`) each wrap one git command and parse its output into typed models. They only call `gitApi.git()`.

### File watcher

`watcher.rs` uses `notify-debouncer-full` with a 600 ms debounce window and inode-stable `FileIdMap`. Events are filtered by path component — ignored dirs: `.git`, `node_modules`, `dist`, `build`, `cache`, `tmp`, `target`, `.angular`.

`FileWatcherService` (`src/app/services/file-watcher.service.ts`) wraps `window.electron.chokidar.watch/on/close` and exposes `onWorkingDirFileChange$` via `auditTime(300)`. Git-refresh subscribes with `switchMap(() => updateWorkingDirChanges())` so a new file event cancels the previous in-flight `git status`.

### Refresh pipeline

`GitRefreshService` orchestrates all data refreshes:

1. **`refreshAll()`** — on app load, window focus, and manual trigger. Runs `updateWorkingDirChanges`, `updateLogsAndBranches`, and `updateRebaseStatus` in parallel via `forkJoin`.
2. **`updateLogsAndBranches()`** — two-phase waterfall: Phase 1 fetches stashes + remote tags in parallel, Phase 2 uses those results to fetch logs + branches + tags + detached HEAD in parallel.
3. **File-triggered refresh** — `FileWatcherService` emits via `auditTime(300)`, then `throttleTime(500, trailing)` + `switchMap(() => updateWorkingDirChanges())` in the refresh service to cancel in-flight calls.

### State management

Two Angular Signal stores:

- **`GitRepositoryStore`** — list of all repos, persisted to localStorage. Source of truth.
- **`CurrentRepoStore`** — computed projections of the selected repo (logs, branches, workDirStatus, selectedCommit, etc.). All derived via `computed()` from `GitRepositoryStore`. Call `currentRepo.update(partial)` to mutate.

### Key models

- `GitRepository` — the main model stored in `GitRepositoryStore`; holds logs, branches, stashes, tags, workDirStatus, selectedCommitsShas.
- `Commit` — from `src/app/lib/github-desktop/model/commit.ts` (ported from github-desktop).
- `Branch`, `Tag`, `WorkingDirectoryFileChange` — in `src/app/models/` and `src/app/lib/github-desktop/`.

### Linux / WebKitGTK notes

No `GDK_BACKEND` or `WEBKIT_DISABLE_DMABUF_RENDERER` overrides are set — the app runs with whatever backend WebKitGTK negotiates at runtime. If rendering issues appear on specific drivers/compositors, these can be set via environment variable before launch.

## Known issues / active TODOs

- Rebase state management is broken in some flows
- Light mode exists but is visually incomplete
- `reset --mixed` to previous commit doesn't refresh the log correctly
