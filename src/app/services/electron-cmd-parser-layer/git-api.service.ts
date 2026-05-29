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

@Injectable({
  providedIn: 'root',
})
export class GitApiService {

  private currentRepo = inject(CurrentRepoStore);
  private history = inject(GitCommandHistoryService);
  private settings = inject(SettingsService);

  gitFound = signal(true);

  constructor() {
    this.git(['--version']).pipe(
      map(v => `Git binary: ${this.settings.gitBin}, version: ${v.trim()}`),
      catchError(() => { this.gitFound.set(false); return of(null); }),
    ).subscribe(v => v && console.log({v}));
  }

  git = (args: (string | undefined)[] | undefined, options?: ExecOptions) => {
    const filteredArgs = args?.filter(notUndefined) ?? [];
    return this.waitForLock().pipe(
      switchMap(() => this.exec(this.settings.gitBin, filteredArgs, {cwd: this.currentRepo.cwd(), env: window.electron.process.env, ...options})),
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
    this.waitForLock().pipe(map(() => {
      const result = window.electron.spawnSync(this.settings.gitBin, args, {cwd: this.currentRepo.cwd(), input, env: window.electron.process.env});
      if (result.status !== 0) throw new Error(`Git exited ${result.status}\n${result.stderr}`);
      return result.stdout;
    }));

  clone = (url: string, repoName: string, dir: string) =>
    this.git(['clone', url, repoName], {cwd: dir, env: window.electron.process.env});

  exec = (cmd: string, args: string[] = [], options?: ExecOptions) =>
    from(window.electron.execFile(`${cmd}`, args, omitUndefined({...options, stdio: 'inherit', maxBuffer: 10000000})))
      .pipe(
        map(({stdout}) => stdout),
        tap(isDevMode() ? showPerf(cmd, args) : () => 0),
      );

  spawn = (cmd: string, args: string[] = [], options?: SpawnOptionsWithoutStdio) =>
    this.waitForLock().pipe(switchMap(() => new Observable<string>(observer => {
      window.electron.spawn(cmd === 'git' ? this.settings.gitBin : cmd, args, {cwd: this.currentRepo.cwd(), env: window.electron.process.env, ...options})
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

    return defer(() => {
      if (!window.electron.fs.existsSync(lockFile)) return of(undefined);
      if (Date.now() - start > maxWaitMs) return throwError(() => new Error('Git lock timeout'));
      return throwError(() => new Error('Lock exists')); // triggers retry
    })
      .pipe(retry({delay: intervalMs, count: 10}));
  };

  recheckGit = () =>
    this.git(['--version'])
      .pipe(catchError(() => of(null)))
      .subscribe(v => { if (v) this.gitFound.set(true); });

}
