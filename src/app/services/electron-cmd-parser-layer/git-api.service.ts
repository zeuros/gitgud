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
import {catchError, defer, from, map, Observable, of, retry, switchMap, tap, throwError} from 'rxjs';
import {notUndefined, omitUndefined, showPerf} from '../../utils/utils';
import {type ExecOptions, type SpawnOptionsWithoutStdio} from 'node:child_process';
import {GitCommandHistoryService} from '../git-command-history.service';
import {SettingsService} from '../settings.service';
import {CurrentRepoStore} from '../../stores/current-repo.store';

// Git invokes GIT_EDITOR as: `$GIT_EDITOR /path/to/msg/file` — we want a no-op that exits 0.
// On Windows (cmd.exe): "cmd /c exit 0" — ignores extra args. On Unix: "true".
const noopEditor = () =>
  window.tauri.process.platform === 'win32' ? 'cmd /c exit 0' : 'true';

@Injectable({
  providedIn: 'root',
})
export class GitApiService {

  private currentRepo = inject(CurrentRepoStore);
  private history = inject(GitCommandHistoryService);
  private settings = inject(SettingsService);

  gitFound = signal(true);

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
    return this.waitForLock().pipe(
      switchMap(() => this.exec(this.settings.gitBin, filteredArgs, {cwd: this.currentRepo.cwd(), env: {...window.tauri.process.env, GIT_EDITOR: noopEditor()}, ...options})),
    );
  };

  // User git calls
  gitAction = (args: (string | undefined)[] | undefined, options?: ExecOptions) => {
    const filteredArgs = args?.filter(notUndefined) ?? [];
    const cwd = this.currentRepo.cwd();
    return this.git(args, options).pipe(
      tap({
        next: () => this.history.record(filteredArgs, cwd, true),
        error: () => this.history.record(filteredArgs, cwd, false),
      }),
    );
  };

  gitWithInput = (args: string[], input: string) =>
    this.waitForLock().pipe(
      switchMap(() => from(window.tauri.spawnSync(
        this.settings.gitBin, args,
        {cwd: this.currentRepo.cwd(), input, env: window.tauri.process.env as Record<string, string>},
      ))),
      map(result => {
        if (result.status !== 0) throw new Error(`Git exited ${result.status}\n${result.stderr}`);
        return result.stdout;
      }),
    );

  clone = (url: string, repoName: string, dir: string) =>
    this.git(['clone', url, repoName], {cwd: dir, env: window.tauri.process.env});

  init = (dir: string) =>
    this.git(['init'], {cwd: dir, env: window.tauri.process.env});

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
      window.tauri.spawn(cmd === 'git' ? this.settings.gitBin : cmd, args, {cwd: this.currentRepo.cwd() ?? undefined, env: window.tauri.process.env, ...(options as Record<string, unknown>)})
        .then(out => {
          if (isDevMode()) showPerf(cmd, args, out);
          observer.next(out);
          observer.complete();
        })
        .catch(e => observer.error(e));
    })));

  /**
   * Guards against external git processes, but:
   * 1. The maxWaitMs / count duality is confusing — only one should drive the retry limit
   * 2. 700ms may time out prematurely for longer external operations
   */
  waitForLock = (maxWaitMs = 700, intervalMs = 100): Observable<void> => {
    const lockFile = `${this.currentRepo.cwd()}/.git/index.lock`;
    const start = Date.now();

    return defer(() =>
      from(window.tauri.fs.exists(lockFile)).pipe(
        switchMap(exists => {
          if (!exists) return of(undefined as void);
          if (Date.now() - start > maxWaitMs) return throwError(() => new Error('Git lock timeout'));
          return throwError(() => new Error('Lock exists'));
        }),
      ),
    ).pipe(retry({delay: intervalMs, count: 10}));
  };

  recheckGit = () =>
    this.git(['--version'])
      .pipe(catchError(() => of(null)))
      .subscribe(v => { if (v) this.gitFound.set(true); });

}
