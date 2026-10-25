## Commands

The scripts are in `package.json`; what they don't tell:

- `npm start` runs the app in dev (`tauri dev`, which serves Angular on port 4201); `ng:serve` alone has no Tauri bridge.
- Single test file: `npx vitest run src/path/to/file.spec.ts`. `npx eslint --fix <files>` fixes what `npm run lint` reports, e.g. type imports.
- Release: `npm version <x.y.z>`. Its hook (`scripts/version.sh`) stamps the version into Cargo, tauri.conf, the AppStream metainfo, the flatpak manifest and the website, and stages them into the version commit.
- `npm run video` records `docs/show.mp4` + `.webm` on its own Xvfb, rebuilding the release binary first if sources are newer. Its soundtrack `e2e/music.wav` isn't committed: `node e2e/export-music.mjs` renders it (headless Firefox) from the Strudel tune `e2e/music.html`, which also plays and exports in a browser; the video script runs it when the tune is newer.
- Cargo, from `src-tauri/`: `cargo check`, `cargo clippy`.

CI (`.github/workflows/ci.yml`) runs `npm test` on pushes and pull requests; `release.yml`, `flatpak.yml` and `pages.yml` build the packages and the website.

### Running e2e / driving the app headless

The e2e specs drive the **release** binary `src-tauri/target/release/gitgud`: rebuild it after changes with `npx tauri build --no-bundle`. `npm run e2e:setup` recreates the demo repos in `/tmp/gitgud-demo-*`.

On a GNOME (Wayland) desktop, `npm run e2e` uses `xvfb-maybe`, which sees `DISPLAY=:0` (Xwayland) and runs the app **on the real desktop**. To run in the background instead, use a private Xvfb and hide Wayland:

```bash
npm run e2e:setup && env -u WAYLAND_DISPLAY LIBGL_ALWAYS_SOFTWARE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 \
  xvfb-run -a -s "-screen 0 1600x900x24 -ac +extension GLX +render" npx wdio run wdio.conf.ts --spec e2e/<name>.spec.ts
```

The software-rendering variables come from the demo recording setup; that command works with them, it wasn't checked without. Keep this kind of setup in the environment: no app code is specific to this machine (NVIDIA + Wayland, see Linux / WebKitGTK notes).

Driving it from a spec (WebdriverIO, helpers in `e2e/utils/helpers.ts`):
- Before a run, check nothing listens on port 4444 (`ss -ltnp | grep 4444`): a `tauri-driver` left over from an earlier run keeps it, wdio then talks to that one, and the app opens on that driver's display (e.g. the real desktop) while Xvfb stays black. Kill it first.
- Screenshots: grab the Xvfb display (`ffmpeg -f x11grab -i $DISPLAY -frames:v 1 shot.png`). Results are also easy to check through the DOM and the repo's git state.
- Toasts: wait with `waitForExist`; `waitForDisplayed` times out while they animate.
- The log only renders rows near the viewport (`renderWindow`): find a commit through the search (Ctrl+F, type, Enter selects the match) rather than by its row.
- A second repo: the `+` tab button opens a "New tab" page; stub `window.tauri.dialog.showOpenDialog` then click its `Open` button.

As of Oct 2026 these specs fail on steps unrelated to recent changes (out of date selectors or flows): `search-merge` (no `.conflicted-section` after opening the conflict repo, also failing on 617e0c92), `git-ops` (left panel tree selector), `diff-staging` (`p-select.settings-select`).

## Stack

Tauri 2 + Angular 22 + Monaco Editor. All development is in `src-tauri/` (Rust backend) and `src/app/api/tauri-bridge.ts` (JS bridge). UI uses PrimeNG components and Angular Signals throughout.

## Architecture

### The Tauri IPC bridge (`src/app/api/tauri-bridge.ts` → `src/typings.d.ts`)

`tauri-bridge.ts` implements `window.tauri` using Tauri IPC (`@tauri-apps/api/core` `invoke` + `listen`). The TypeScript interface is declared in `src/typings.d.ts` as `TauriApi`.

On startup `installTauriBridge()` calls `buildBridge()`, which kills any stale watchers (`close_all_watchers`) and reads version/platform/arch/env via parallel IPC calls, then installs the bridge at `window.tauri`.

**Rust commands** live in `src-tauri/src/commands/` and are registered in `src-tauri/src/lib.rs`:

| Module | Commands |
|--------|---------|
| `fs.rs` | `fs_readdir`, `fs_is_file`, `fs_write_file`, `fs_read_file`, `fs_read_file_bytes`, `fs_size`, `fs_exists`, `fs_mtime` |
| `process.rs` | `exec_file`, `exec_file_bytes`, `spawn_sync_cmd`, `spawn_cmd`, `find_processes` |
| `watcher.rs` | `watch_paths`, `close_watcher`, `close_all_watchers` |
| `util.rs` | `crypto_md5`, `get_env`, `get_platform`, `get_arch`, `get_package_format`, `get_build_commit`, `show_item_in_folder` |

### Git execution layer

`GitApiService` (`src/app/services/electron-cmd-parser-layer/git-api.service.ts`) is the sole entry point for running git. It calls `window.tauri.execFile`, which routes to the Rust `exec_file` command backed by `ShellPoolManager` (`src-tauri/src/shell_pool.rs`) — a pool of 6 persistent bash processes per repo path. This eliminates per-call `fork()+execve()` overhead (~30ms each).

- `git()` — read operations, used by reader services
- `gitAction()` — user-triggered mutations (commit, rebase, push…), also records to history
- `waitForLock()` — waits for `index.lock` to go away before a call, except for read-only subcommands (`log`, `status`, `diff`…)
- `gitDirs()` / `gitPath(name)` — the repo's git dir and common dir (`git rev-parse --absolute-git-dir --git-common-dir`, memoized per cwd). In a linked worktree `.git` is a file and per-worktree state (`index.lock`, `rebase-merge`, `COMMIT_EDIT_MSG`, `HEAD`…) lives in `<main>/.git/worktrees/<name>`, while refs are shared: never build `${cwd}/.git/...` paths, use `gitPath()`

Reader services (`electron-cmd-parser-layer/`) each wrap one git command and parse its output into typed models. They only call `gitApi.git()`.

### File watcher

`watcher.rs` uses `notify` directly with its own debounce: a flush thread emits one batch of deduplicated paths after 600 ms of quiet, or at most 2 s after the first pending event. Events are filtered by path component — ignored dirs: `.git`, `node_modules`, `dist`, `build`, `cache`, `tmp`, `target`, `.angular`.

On Linux, recursive watches are not delegated to inotify: `watch_tree` walks the repo and adds a non-recursive watch per directory, skipping ignored dirs and symlinks, so no watches are registered inside `node_modules`/`target`. Directories created later are watched by the flush thread. Other platforms use a single recursive watch.

`FileWatcherService` (`src/app/services/file-watcher.service.ts`) wraps `window.tauri.chokidar.watch/on/close` and exposes `onWorkingDirFileChange$` via `auditTime(300)`. Git-refresh subscribes with `switchMap(() => updateWorkingDirChanges())` so a new file event cancels the previous in-flight `git status`.

### Refresh pipeline

`GitRefreshService` orchestrates all data refreshes:

1. **`refreshAll()`** — on app load, after toolbar actions, and manual trigger. Runs `updateWorkingDirChanges`, `updateLogsAndBranches`, and `updateRebaseStatus` in parallel via `forkJoin`.
   On window focus, only the status and rebase state are refreshed, unless git's state files (`HEAD`, `index`, refs, `FETCH_HEAD`…; mtimes compared with the last focus) changed in the background, then `refreshAll()`.
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

### TypeScript conventions

`tsconfig.json` is strict (no unused code, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, Angular `strictTemplates`…) and `npm run lint` must pass:
- No explicit `any`: use `unknown`, a precise type or a generic.

### Naming conventions

- A name says what the value is, including its kind or unit: `mainWorktreePath`, not `mainWorktree`; `pollMs`, `branchName`, `repoId`.
- Use git's own vocabulary (main worktree, linked worktree, upstream…), never an invented synonym, and one term per concept across code, tests and UI.
- No abbreviations or one-letter names, except loop indexes and short lambda parameters.
- If a name needs a comment to be understood, rename it instead.
- Comments describe what the code does or why, not its history ("older versions…", "was removed").

### Linux / WebKitGTK notes

On Wayland with the NVIDIA proprietary driver (`/sys/module/nvidia` present), `patch_nvidia_wayland()` in `lib.rs` sets `__NV_DISABLE_EXPLICIT_SYNC=1` at startup (otherwise WebKitGTK crashes with Wayland "Error 71 (Protocol error)"). On that combo the web process leaks GPU sync fences (`anon_inode:sync_file`, ~2 fds per frame drawn), so it also raises the open-files soft limit to the hard limit (GNOME launches apps with 1024, which crashed it with "Too many open files"). Values already set in the environment are left alone. Avoid `WEBKIT_DISABLE_DMABUF_RENDERER=1`: it switches WebKitGTK to CPU rendering (~23 fps vs 60 when scrolling the log); `GDK_BACKEND=x11` with DMA-BUF fails to allocate GBM buffers on NVIDIA. Everyone else gets whatever backend WebKitGTK negotiates.
