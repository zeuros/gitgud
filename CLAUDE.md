## Commands

The scripts are in `package.json`; what they don't tell:

- `npm start` runs the app in dev (`tauri dev`, which serves Angular on port 4201); `ng:serve` alone has no Tauri bridge.
- Single test file: `npx vitest run src/path/to/file.spec.ts`. `npx eslint --fix <files>` fixes what `npm run lint` reports, e.g. type imports.
- Release: `npm version <x.y.z>`. Its hook (`scripts/version.sh`) stamps the version into Cargo, tauri.conf, the AppStream metainfo, the flatpak manifest and the website, and stages them into the version commit.
- `npm run video` records `docs/show.mp4` + `.webm` on its own Xvfb, rebuilding the release binary first if sources are newer.
- `bash e2e/videos/quests/record.sh [quest…]` records the website's Quests videos (`docs/quests/<quest>.mp4`, `.webm`, `.jpg` poster) the same way, one spec per quest, cut to the scene each spec marks.
- Cargo, from `src-tauri/`: `cargo check`, `cargo clippy`.

CI (`.github/workflows/ci.yml`) runs `npm run lint` and `npm test` on pushes to main and pull requests, and `cargo clippy -- -D warnings` when `src-tauri/` or the workflow changed; `release.yml`, `flatpak.yml` and `pages.yml` build the packages and the website.

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
- `wdio.conf.ts` points the app's `XDG_*` folders to a temp dir: otherwise it shares the user's window state (a desktop-sized window, software-rendered under Xvfb, stalls IPC) and localStorage (wiped by `initRepo`).
- `strictSelectors: false`: the specs' `$()` take the first match.

### Running the unit tests on Windows (Wine)

The specs that run real git (`undo`) then use Git for Windows. Setup, in a worktree:
- A prefix with the Node win-x64 zip unpacked to `C:\node` and PortableGit to `C:\git`; `7z x -o<prefix>/drive_c/git PortableGit-*.7z.exe` unpacks it without running it.
- `npm ci --prefix <worktree> --os=win32 --cpu=x64 --ignore-scripts` installs the win32 bindings (rolldown, esbuild) from Linux.
- Run from the worktree, output to a file (Node under Wine fails with `open EBADF` when stdout/stderr is a pipe):

```bash
WINEPREFIX=<prefix> WINEDEBUG=-all WINEPATH='C:\git\cmd;C:\node' NO_COLOR=1 \
  wine 'C:\node\node.exe' node_modules/vitest/vitest.mjs run --testTimeout=60000 > out.log 2>&1 </dev/null
```

`WINEPATH` holds only `C:\git\cmd`, as the Git for Windows installer puts on `PATH`. Git is several times slower under Wine: the undo specs time out with the default 5 s.

## Stack

Tauri 2 + Angular 22 + Monaco Editor. All development is in `src-tauri/` (Rust backend) and `src/app/api/tauri-bridge.ts` (JS bridge). UI uses PrimeNG components and Angular Signals throughout.

## Architecture

### The Tauri IPC bridge (`src/app/api/tauri-bridge.ts` → `src/typings.d.ts`)

`tauri-bridge.ts` implements `window.tauri` using Tauri IPC (`@tauri-apps/api/core` `invoke` + `listen`). The TypeScript interface is declared in `src/typings.d.ts` as `TauriApi`.

On startup `installTauriBridge()` calls `buildBridge()`, which kills any stale watchers (`close_all_watchers`) and reads version/platform/arch/env via parallel IPC calls, then installs the bridge at `window.tauri`.

**Rust commands** live in `src-tauri/src/commands/` and are registered in `src-tauri/src/lib.rs`:

| Module | Commands |
|--------|---------|
| `agent.rs` | `find_programs`, `open_in_terminal` (the user's terminal, running an LLM CLI) |
| `fs.rs` | `fs_readdir`, `fs_is_file`, `fs_write_file`, `fs_read_file`, `fs_read_file_bytes`, `fs_size`, `fs_exists`, `fs_mtime` |
| `pty.rs` | `pty_spawn`, `pty_list`, `pty_attach`, `pty_write`, `pty_resize`, `pty_kill` (agents started from GitGud, drawn with xterm.js; they outlive a page reload) |
| `transcript.rs` | `search_transcripts`, `read_transcript`, `transcript_titles` (Claude Code transcripts: holding words; what the agent view shows; their titles) |
| `process.rs` | `exec_file`, `exec_file_bytes`, `spawn_sync_cmd`, `spawn_cmd`, `find_processes` |
| `watcher.rs` | `watch_paths`, `close_watcher`, `close_all_watchers` |
| `util.rs` | `crypto_md5`, `get_env`, `get_platform`, `get_arch`, `get_package_format`, `get_build_commit`, `show_item_in_folder` |

### Git execution layer

`GitApiService` (`src/app/services/git/git-api.service.ts`) is the sole entry point for running git. It calls `window.tauri.execFile`, which routes to the Rust `exec_file` command backed by `ShellPoolManager` (`src-tauri/src/shell_pool.rs`) — a pool of 6 persistent bash processes per repo path. This eliminates per-call `fork()+execve()` overhead (~30ms each).

- `git()` — read operations, used by reader services
- `gitAction()` — user-triggered mutations (commit, rebase, push…), also records to history
- `waitForLock()` — waits for `index.lock` to go away before a call, except for read-only subcommands (`log`, `status`, `diff`…)
- `gitDirs()` / `gitPath(name)` — the repo's git dir and common dir (`git rev-parse --absolute-git-dir --git-common-dir`, memoized per cwd). In a linked worktree `.git` is a file and per-worktree state (`index.lock`, `rebase-merge`, `COMMIT_EDIT_MSG`, `HEAD`…) lives in `<main>/.git/worktrees/<name>`, while refs are shared: never build `${cwd}/.git/...` paths, use `gitPath()`

Reader services (`git/`) each wrap one git command and parse its output into typed models. They only call `gitApi.git()`.

Git's editors: `GIT_EDITOR` is `:`, which git takes as no editor, keeping messages as it wrote them. For `git rebase -i`, `RebaseService` names GitGud's own binary as `GIT_SEQUENCE_EDITOR` (`GITGUD_BINARY_NAME`, set at startup by `src-tauri/src/sequence_editor.rs`, which also makes `PATH` find this binary first) and runs git twice. Seeing its own name in `GIT_SEQUENCE_EDITOR` and a `git-rebase-todo` argument, `main()` edits the todo file instead of starting the app: the first run copies git's sequence to `GITGUD_COPY_REBASE_TODO_TO` and exits 1, cancelling the rebase; the second moves the app's sequence from `GITGUD_MOVE_REBASE_TODO_FROM` over it and exits 0. No git process waits on the app.

HTTPS credentials: at startup `credential_helper::configure_git()` sets `GIT_TERMINAL_PROMPT=0` and adds GitGud's binary as a `credential.helper` (through `GIT_CONFIG_COUNT`, after the user's own helpers). Git runs it as `<binary> --git-credential get|store|erase`; it keeps credentials in the keyring, one item per URL: on Linux through oo7 (Secret Service, or the Secret portal's file in a Flatpak); keyring-core elsewhere. An `erase` naming a password spares a credential saved with another one, as git's helper does. When git fails to authenticate, `git()` (`GitSignInService`) opens the sign-in dialog and runs the command again with the credential in `GITGUD_CREDENTIAL_*`, which the helper hands to git; git saves it once accepted and erases a rejected one, so the next failure asks again; a 403 (a credential accepted but not allowed, e.g. a read-only token used to push) asks too. The dialog links known hosts' token pages and SSH guides (`hostHelp`). Auto-fetch passes `signIn: false` and shows a toast with a Sign in button instead. Spawned processes run in their own session (`detach_from_terminal`): a prompt on the terminal the app was started from would stop the app.

### File watcher

`watcher.rs` uses `notify` directly with its own debounce: a flush thread emits one batch of deduplicated paths after 600 ms of quiet, or at most 2 s after the first pending event. Events are filtered by path component below the watched root, skipping the `ignoredDirs` watch option (names at any depth, or right below the root when starting with `/`; none by default; `FileWatcherService` passes `.git` and `node_modules` for the working tree, the rest left to the ignore rules). With `respectGitIgnore` (the working-tree watch), paths the repository's ignore rules exclude are skipped too: the `ignore` crate walks the tree and `GitIgnoreRules` matches events against its `.gitignore` files, `info/exclude` and the global excludes file, all read when the watch starts. Emitted paths use `/` on every platform, as git reports them, so they compare to `gitDirs()` paths.

On Linux, recursive watches are not delegated to inotify: `watch_tree` walks the repo and adds a non-recursive watch per directory, skipping ignored dirs and symlinks, so no watches are registered inside `node_modules`/`target`/`.venv`. Directories created later are watched by the flush thread. Other platforms use a single recursive watch.

A watch that fails rejects `watch_paths` with a `WatchError` (`kind` `watch-limit` when inotify's `fs.inotify.max_user_watches` is reached, with its value, else `other`); a directory created later that hits the limit emits `watcher-error:{id}` once. The bridge hands both to the watcher's `'error'` callbacks, and `FileWatcherService` shows one sticky toast per worktree opened (`watchErrorMessage`): what is missed, and how to raise the limit.

`FileWatcherService` (`src/app/services/file-watcher.service.ts`) wraps `window.tauri.chokidar.watch/on/close`. An effect watches `CurrentRepoStore.cwd`, its cleanup closing the previous worktree's watchers. It exposes `onWorkingDirFileChange$`, one emission per Rust batch (`auditTime(0)`). It also watches git's state, which the working-tree watch skips: the common dir recursively (it holds the refs and, in `worktrees/<name>`, each linked worktree's git dir), skipping `/objects`, `/logs`, `/lfs`, `/modules`, `/hooks`, lock files left out, exposed as `onGitStateChange$` (one array of paths per Rust batch). Git-refresh subscribes with `switchMap(() => updateWorkingDirChanges())` so a new file event cancels the previous in-flight `git status`.

### Refresh pipeline

`GitRefreshService` orchestrates all data refreshes:

1. **`refreshAll()`** — on app load, after toolbar actions, and manual trigger. Runs `updateWorkingDirChanges`, `updateLogsAndBranches`, and `updateRebaseStatus` in parallel via `forkJoin`.
   On window focus, only the status and rebase state are refreshed.
2. **`updateLogsAndBranches()`** — two-phase waterfall: Phase 1 fetches stashes + remote tags in parallel, Phase 2 uses those results to fetch logs + branches + tags + detached HEAD in parallel.
3. **File-triggered refresh** — `FileWatcherService` emits once per Rust batch (already debounced), then `switchMap(() => updateWorkingDirChanges())` in the refresh service cancels the in-flight call.
4. **Git commands run outside the app** — on `onGitStateChange$`, a changed path newer (mtime) than the last log load, or deleted, runs `refreshAll()`; a changed index only refreshes the status. Older writes are the app's own actions (auto-fetch included), which load the log themselves.

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

Class layout, groups separated by a blank line: injected services (private, then the template's), state (form, signals, saved values), constants, template helpers, constructor, then methods. Inside a function, a blank line separates its steps: an early return from the main path, two effects, saving from resetting.

### Naming conventions

- A name says what the value is, including its kind or unit: `mainWorktreePath`, not `mainWorktree`; `pollMs`, `branchName`, `repoId`.
- Use git's own vocabulary (main worktree, linked worktree, upstream…), never an invented synonym, and one term per concept across code, tests and UI.
- No abbreviations or one-letter names, except loop indexes and short lambda parameters.
- If a name needs a comment to be understood, rename it instead.
- Comments describe what the code does or why, not its history ("older versions…", "was removed").

### Linux / WebKitGTK notes

With NVIDIA the web process leaks GPU sync fences (`anon_inode:sync_file`), so `raise_open_files_limit()` in `lib.rs` raises the open-files soft limit to the hard limit (GNOME launches apps with 1024, which crashed it with "Too many open files"). Avoid `WEBKIT_DISABLE_DMABUF_RENDERER=1` outside Xvfb: it switches WebKitGTK to CPU rendering (~23 fps vs 60 when scrolling the log).
