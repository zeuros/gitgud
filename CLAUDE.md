# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start                  # dev: starts Angular dev server + Electron together
npm test                   # run unit tests (vitest, node environment)
npm run build:electron     # compile app/main.ts + app/preload.ts → app/*.js (tsc)
npm run build:prod         # full production build (electron + angular)
npm run build:preview      # build + package + launch locally for manual testing
npm run e2e                # playwright e2e (needs xvfb on headless)
```

Single test file: `npx vitest run src/path/to/file.spec.ts`

## Stack

Electron 40 + Angular 21 + Monaco Editor. No Tauri (the `src-tauri/` dir is a dead branch, ignore it). UI uses PrimeNG components and Angular Signals throughout.

## Architecture

### The Node.js / renderer bridge (`app/preload.ts` → `src/typings.d.ts`)

All Node.js APIs (fs, child_process, chokidar) are exposed to the Angular renderer via `contextBridge.exposeInMainWorld('electron', {...})` in `app/preload.ts`. The TypeScript interface is declared in `src/typings.d.ts` as `ElectronApi` — **these two files must be kept in sync manually**.

`app/preload.ts` is compiled separately from Angular via `tsconfig.serve.json` (outputs to `app/`). Do not import Angular or browser-only code there.

### Git execution layer

`GitApiService` (`src/app/services/electron-cmd-parser-layer/git-api.service.ts`) is the sole entry point for running git. It calls `window.electron.execFile`, which is backed by a `ShellPool` (`app/shell-pool.ts`) — a pool of 6 persistent bash processes per repo path. This eliminates per-call `fork()+execve()` overhead (~30ms each).

- `git()` — read operations, used by reader services
- `gitAction()` — user-triggered mutations (commit, rebase, push…), also records to history
- `waitForLock()` — checks `.git/index.lock` before every call

Reader services (`electron-cmd-parser-layer/`) each wrap one git command and parse its output into typed models. They only call `gitApi.git()`.

### Refresh pipeline

`GitRefreshService` orchestrates all data refreshes:

1. **`refreshAll()`** — on app load, window focus, and manual trigger. Runs `updateWorkingDirChanges`, `updateLogsAndBranches`, and `updateRebaseStatus` in parallel via `forkJoin`.
2. **`updateLogsAndBranches()`** — two-phase waterfall: Phase 1 fetches stashes + remote tags in parallel, Phase 2 uses those results to fetch logs + branches + tags + detached HEAD in parallel.
3. **File-triggered refresh** — `FileWatcherService` (chokidar) emits via `auditTime(300)`, then `switchMap(() => updateWorkingDirChanges())` in the refresh service to cancel in-flight calls.

Ignored watcher paths: `.git`, `node_modules`, `dist`, `build`, `target`, `cache`, `tmp`.

### State management

Two Angular Signal stores:

- **`GitRepositoryStore`** — list of all repos, persisted to localStorage. Source of truth.
- **`CurrentRepoStore`** — computed projections of the selected repo (logs, branches, workDirStatus, selectedCommit, etc.). All derived via `computed()` from `GitRepositoryStore`. Call `currentRepo.update(partial)` to mutate.

### Key models

- `GitRepository` — the main model stored in `GitRepositoryStore`; holds logs, branches, stashes, tags, workDirStatus, selectedCommitsShas.
- `Commit` — from `src/app/lib/github-desktop/model/commit.ts` (ported from github-desktop).
- `Branch`, `Tag`, `WorkingDirectoryFileChange` — in `src/app/models/` and `src/app/lib/github-desktop/`.

## Known issues / active TODOs

- Rebase state management is broken in some flows
- Light mode exists but is visually incomplete
- `reset --mixed` to previous commit doesn't refresh the log correctly
