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

import {computed, effect, inject, Injectable, signal, untracked} from '@angular/core';
import {catchError, from, map, type Observable, of, switchMap, tap, throwError} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {GitRefreshService} from './git-refresh.service';
import {ToastService} from './toast.service';
import {GitCommandHistoryService} from './git-command-history.service';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {parseReflog, planRedo, planUndo, REFLOG_DEPTH, REFLOG_FORMAT, type ReflogEntry, runPlan, type UndoPlan} from '../utils/undo.utils';

@Injectable({providedIn: 'root'})
export class UndoService {

  private gitApi = inject(GitApiService);
  private gitRefresh = inject(GitRefreshService);
  private toast = inject(ToastService);
  private history = inject(GitCommandHistoryService);
  private currentRepo = inject(CurrentRepoStore);

  // Both are read back from the reflog (see undo.utils), nothing is kept in memory
  private undoPlan = signal<UndoPlan | undefined>(undefined);
  private redoPlan = signal<UndoPlan | undefined>(undefined);

  undoAvailable = computed(() => !!this.undoPlan());
  undoTooltip = computed(() => this.undoPlan()?.label ?? 'Nothing to undo');
  redoAvailable = computed(() => !!this.redoPlan());
  redoTooltip = computed(() => this.redoPlan()?.label ?? 'Nothing to redo');

  constructor() {
    // Whatever can be undone shows up in one of these
    effect(() => {
      this.currentRepo.cwd();
      this.currentRepo.logs();
      this.currentRepo.stashes();
      this.currentRepo.branches();
      this.currentRepo.tags();
      this.currentRepo.remoteTags();
      untracked(this.refreshTooltip);
    });
  }

  refreshTooltip = () =>
    this.readReflog().subscribe(reflog => {
      this.undoPlan.set(planUndo(reflog));
      this.redoPlan.set(planRedo(reflog));
    });

  undo = () => this.apply(planUndo, 'Undone');

  redo = () => this.apply(planRedo, 'Redone');

  // Plans from a fresh reflog: the one behind the tooltip may predate an action done outside the app
  private apply = (planner: (reflog: ReflogEntry[]) => UndoPlan | undefined, done: 'Undone' | 'Redone') =>
    this.readReflog().pipe(
      map(planner),
      switchMap(plan => plan ? this.run(plan) : throwError(() => new Error(`Nothing to ${done == 'Undone' ? 'undo' : 'redo'}`))),
      switchMap(this.gitRefresh.refreshAll),
    ).subscribe({
      next: () => { this.toast.success(done); this.refreshTooltip(); },
      error: e => { this.toast.err(e?.message ?? `${e}`); this.refreshTooltip(); },
    });

  private readReflog = (): Observable<ReflogEntry[]> =>
    this.currentRepo.cwd()
      ? this.gitApi.git(['reflog', '-n', `${REFLOG_DEPTH}`, `--format=${REFLOG_FORMAT}`]).pipe(map(parseReflog), catchError(() => of([])))
      : of([]);

  private run = (plan: UndoPlan) => {
    const cwd = this.currentRepo.cwd();
    const record = (success: boolean) => plan.steps.forEach(({args}) => this.history.record(args, cwd, success));
    return from(runPlan(plan, this.gitApi.gitRunner)).pipe(tap({next: () => record(true), error: () => record(false)}));
  };

}
