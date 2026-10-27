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

import {inject, Injectable, isDevMode, signal} from '@angular/core';

// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting JavaScript file will look as if you never imported the module at all.
// import type {ExecOptions} from 'child_process';
import {catchError, defer, firstValueFrom, from, map, Observable, of, retry, switchMap, tap, throwError, timer} from 'rxjs';
import {notUndefined, omitUndefined, showPerf} from '../../utils/utils';
import type {ExecOptions, SpawnOptionsWithoutStdio} from 'node:child_process';
import {GitCommandHistoryService} from '../git-command-history.service';
import {SettingsService} from '../settings.service';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {type GitRunner, journalFor, runJournaled} from '../../utils/undo.utils';
import {type GitDirs, gitPath} from '../../utils/git-path.utils';

// Git invokes GIT_EDITOR as: `$GIT_EDITOR /path/to/msg/file` — we want a no-op that exits 0.
// On Windows (cmd.exe): "cmd /c exit 0" — ignores extra args. On Unix: "true".
export const noopEditor = () =>
  window.tauri.process.platform === 'win32' ? 'cmd /c exit 0' : 'true';

// Subcommands that never write the index: they don't need to wait for .git/index.lock,
// which saves an fs_exists IPC round trip per call on the hot refresh path.
const READ_ONLY_SUBCOMMANDS = new Set([
  '--version', 'log', 'show', 'diff', 'status', 'rev-parse', 'rev-list', 'for-each-ref', 'reflog',
  'name-rev', 'ls-remote', 'cat-file', 'ls-files', 'merge-base', 'describe', 'blame',
]);

// First non-option arg, skipping `-c key=val` pairs
const subcommand = (args: string[]) => {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-c' || args[i] === '-C') i++;
    else if (args[i] === '--version' || !args[i].startsWith('-')) return args[i];
  }
  return undefined;
};

const needsLock = (args: string[]) => !READ_ONLY_SUBCOMMANDS.has(subcommand(args) ?? '');

@Injectable({
  providedIn: 'root',
})
export class GitApiService {

  private currentRepo = inject(CurrentRepoStore);
  private history = inject(GitCommandHistoryService);
  private settings = inject(SettingsService);

  gitFound = signal(true);

  private gitDirsByCwd = new Map<string, Promise<GitDirs>>();

  constructor() {
    // Must supply a cwd so exec_file routes through the shell pool (bash) which has
    // a full PATH — without it exec_file_direct runs with the bare launch environment
    // and misses git even when git is installed.
    const env = window.tauri?.process?.env;
    const cwd = env?.['HOME'] ?? env?.['USERPROFILE'] ?? '/tmp';
    this.git(['--version'], {cwd}).pipe(
      map(v => `Git binary: ${this.settings.gitBin}, version: ${v.trim()}`),
      catchError(() => { this.gitFound.set(false); return of(null); }),
    ).subscribe(v => v && console.log({v}));
  }

  git = (args: (string | undefined)[] | undefined, options?: ExecOptions) => {
    const filteredArgs = args?.filter(notUndefined) ?? [];
    // env is overlaid on the backend's own environment, so only send what differs
    const run = () => this.exec(this.settings.gitBin, filteredArgs, {cwd: this.currentRepo.cwd(), env: {GIT_EDITOR: noopEditor()}, ...options});
    return needsLock(filteredArgs) ? this.waitForLock().pipe(switchMap(run)) : defer(run);
  };

  // Where git keeps this repository's state, which isn't `<cwd>/.git` in a linked worktree. Asked once per repository
  gitDirs = (cwd = this.currentRepo.cwd()!): Promise<GitDirs> => {
    let dirs = this.gitDirsByCwd.get(cwd);
    if (!dirs) {
      dirs = firstValueFrom(this.git(['rev-parse', '--path-format=absolute', '--absolute-git-dir', '--git-common-dir'], {cwd}))
        .then(out => {
          const [gitDir, commonDir] = out.trim().split('\n');
          return {gitDir, commonDir};
        });
      // Not a repository (yet): ask again next time
      dirs.catch(() => this.gitDirsByCwd.delete(cwd));
      this.gitDirsByCwd.set(cwd, dirs);
    }
    return dirs;
  };

  /** Absolute path of `name` (e.g. 'rebase-merge', 'refs/stash') in the current repository's git directory */
  gitPath = (name: string, cwd = this.currentRepo.cwd()!) => this.gitDirs(cwd).then(dirs => gitPath(dirs, name));

  // Raw stdout bytes, for binary content (git show of an image blob…)
  gitBytes = (args: string[]) =>
    defer(() => from(window.tauri.execFileBytes(this.settings.gitBin, args, {cwd: this.currentRepo.cwd() ?? undefined})));

  // User git calls
  gitAction = (args: (string | undefined)[] | undefined, options?: ExecOptions) => {
    const filteredArgs = args?.filter(notUndefined) ?? [];
    const cwd = this.currentRepo.cwd();
    const action$ = this.git(args, options).pipe(
      tap({
        next: () => this.history.record(filteredArgs, cwd, true),
        error: () => this.history.record(filteredArgs, cwd, false),
      }),
    );
    // Stashes, branches and tags leave no trace in the reflog of HEAD: journaled there to be undoable
    return journalFor(filteredArgs) ? defer(() => from(runJournaled(filteredArgs, () => firstValueFrom(action$), this.gitRunner))) : action$;
  };

  // Promise flavour of git(), for the undo journal. Spawns directly when an environment or stdin is needed: the
  // shell pool keeps one set of shells per distinct environment
  gitRunner: GitRunner = (args, {reflogAction, input} = {}) =>
    firstValueFrom(reflogAction === undefined && input === undefined
      ? this.git(args)
      : this.waitForLock().pipe(
        switchMap(() => from(window.tauri.spawnSync(this.settings.gitBin, args, {
          cwd: this.currentRepo.cwd(),
          input,
          ...(reflogAction === undefined ? {} : {env: {GIT_REFLOG_ACTION: reflogAction}}),
        }))),
        map(({status, stdout, stderr}) => {
          if (status !== 0) throw new Error(stderr.trim() || `Git exited ${status}`);
          return stdout;
        }),
      ));

  gitWithInput = (args: string[], input: string) =>
    this.waitForLock().pipe(
      switchMap(() => from(window.tauri.spawnSync(
        this.settings.gitBin, args,
        {cwd: this.currentRepo.cwd(), input},
      ))),
      map(result => {
        if (result.status !== 0) throw new Error(`Git exited ${result.status}\n${result.stderr}`);
        return result.stdout;
      }),
    );

  clone = (url: string, repoName: string, dir: string) =>
    this.git(['clone', url, repoName], {cwd: dir});

  init = (dir: string) =>
    this.git(['init'], {cwd: dir});

  exec = (cmd: string, args: string[] = [], options?: ExecOptions) =>
    from(window.tauri.execFile(`${cmd}`, args, omitUndefined({
      ...options,
      cwd: options?.cwd as string | undefined,
      env: options?.env as Record<string, string> | undefined,
      stdio: 'inherit',
      maxBuffer: 10000000,
    })))
      .pipe(
        map(({stdout}) => stdout),
        tap(isDevMode() ? showPerf(cmd, args) : () => 0),
      );

  spawn = (cmd: string, args: string[] = [], options?: SpawnOptionsWithoutStdio) =>
    this.waitForLock().pipe(switchMap(() => new Observable<string>(observer => {
      window.tauri.spawn(cmd === 'git' ? this.settings.gitBin : cmd, args, {cwd: this.currentRepo.cwd() ?? undefined, ...(options as Record<string, unknown>)})
        .then(out => {
          if (isDevMode()) showPerf(cmd, args, out);
          observer.next(out);
          observer.complete();
        })
        .catch(e => observer.error(e));
    })));

  // Waits for another git process (a terminal, an IDE…) to release index.lock, checking every intervalMs, for at most maxWaitMs
  waitForLock = (maxWaitMs = 2000, intervalMs = 100): Observable<void> => {
    // No repository yet (clone, init…): nothing can hold its lock
    const lockExists = () => this.currentRepo.cwd()
      ? this.gitPath('index.lock').then(window.tauri.fs.exists).catch(() => false)
      : Promise.resolve(false);

    return defer(() => {
      const deadline = Date.now() + maxWaitMs;
      return defer(lockExists).pipe(
        switchMap(exists => exists ? throwError(() => new Error('index.lock exists')) : of(undefined as void)),
        retry({
          delay: () => Date.now() < deadline
            ? timer(intervalMs)
            : throwError(() => new Error('Another git process is running: its index.lock is still there (remove it if no git process is left)')),
        }),
      );
    });
  };

  recheckGit = () =>
    this.git(['--version'])
      .pipe(catchError(() => of(null)))
      .subscribe(v => { if (v) this.gitFound.set(true); });

}
