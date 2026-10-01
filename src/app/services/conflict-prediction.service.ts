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

import {inject, Injectable, signal} from '@angular/core';
import {type MenuItem} from 'primeng/api';
import {catchError, from, map, of} from 'rxjs';
import {SettingsService} from './settings.service';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {ActiveContextMenuService} from './active-context-menu.service';
import {parseMergeTreeConflicts} from '../utils/conflict-prediction.utils';

/** Tells which files would conflict when merging two commits, without touching the repository (needs git 2.38+) */
@Injectable({providedIn: 'root'})
export class ConflictPredictionService {

  private settings = inject(SettingsService);
  private currentRepo = inject(CurrentRepoStore);
  private activeContextMenu = inject(ActiveContextMenuService);

  // Conflicted paths by pair of commits: those never change
  private predictions = signal<Record<string, string[]>>({});

  /** Conflicted paths when merging these two commits, undefined when not predicted (yet). Reactive */
  conflictsBetween = (ours?: string, theirs?: string): string[] | undefined => this.predictions()[`${ours} ${theirs}`];

  // Direct spawn: a conflicting merge exits with 1, which the shell pool reports as an error without the output
  private predict = (ours: string, theirs: string) =>
    from(window.tauri.spawnSync(this.settings.gitBin, ['merge-tree', '--write-tree', '--name-only', '--no-messages', ours, theirs], {cwd: this.currentRepo.cwd()})).pipe(
      map(({status, stdout}) => parseMergeTreeConflicts(status, stdout)),
      catchError(() => of([])),
    );

  /**
   * Predicts the merge of two commits, then refreshes the context menu built by `menu` if it is still the one shown.
   * `menu` is expected to read conflictsBetween.
   */
  predictForMenu = (ours: string | undefined, theirs: string | undefined, menu: () => MenuItem[]) => {
    if (!ours || !theirs || ours == theirs) return;
    const shown = menu();

    this.predict(ours, theirs).subscribe(conflicts => {
      this.predictions.update(predictions => ({...predictions, [`${ours} ${theirs}`]: conflicts}));
      if (conflicts.length && this.activeContextMenu.contextMenu() === shown) this.activeContextMenu.contextMenu.set(menu());
    });
  };
}
