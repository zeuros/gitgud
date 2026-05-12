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

import {computed, inject, Injectable, signal} from '@angular/core';
import {switchMap} from 'rxjs';
import {GitApiService} from './electron-cmd-parser-layer/git-api.service';
import {GitRefreshService} from './git-refresh.service';
import {PopupService} from './popup.service';

type RedoItem = ({type: 'reset'; sha: string} | {type: 'checkout'; branch: string}) & {message: string};

@Injectable({providedIn: 'root'})
export class UndoService {

  private gitApi = inject(GitApiService);
  private gitRefresh = inject(GitRefreshService);
  private popup = inject(PopupService);

  private redoStack = signal<RedoItem[]>([]);
  undoTooltip = signal('Undo last action');
  redoAvailable = computed(() => this.redoStack().length > 0);
  redoTooltip = computed(() => this.redoStack().at(-1)?.message ?? 'Nothing to redo');

  private parseAction(reflogSubject: string, prefix: 'Undo' | 'Redo'): string {
    const body = reflogSubject.replace(/^[^:]+:\s*/, '');
    if (reflogSubject.startsWith('commit (amend):')) return `${prefix} amending: ${body}`;
    if (reflogSubject.startsWith('commit (merge):')) return `${prefix} merging: ${body}`;
    if (reflogSubject.startsWith('commit:')) return `${prefix} committing of: ${body}`;
    if (reflogSubject.startsWith('cherry-pick:')) return `${prefix} cherry-pick of: ${body}`;
    if (reflogSubject.startsWith('checkout:')) {
      const branch = reflogSubject.match(/moving from .+ to (.+)/)?.[1]?.trim();
      return branch ? `${prefix} checkout to: ${branch}` : `${prefix} checkout`;
    }
    return `${prefix} last action`;
  }

  clearRedoStack = () => this.redoStack.set([]);

  refreshTooltip = () =>
    this.gitApi.git(['reflog', '-1', '--format=%gs'])
      .subscribe(gs => this.undoTooltip.set(gs.trim() ? this.parseAction(gs.trim(), 'Undo') : 'Undo last action'));

  undo = () =>
    this.gitApi.git(['reflog', '-1', '--format=%H\t%gs']).pipe(
      switchMap(line => {
        const [sha, ...rest] = line.trim().split('\t');
        const gs = rest.join('\t');
        if (gs.startsWith('checkout:')) {
          const from = gs.match(/moving from (.+) to .+/)?.[1]?.trim() ?? '';
          const to = gs.match(/moving from .+ to (.+)/)?.[1]?.trim() ?? '';
          this.redoStack.update(s => [...s, {type: 'checkout', branch: to, message: this.parseAction(gs, 'Redo')}]);
          return this.gitApi.git(['checkout', from]);
        }
        this.redoStack.update(s => [...s, {type: 'reset', sha, message: this.parseAction(gs, 'Redo')}]);
        return this.gitApi.git(['reset', '--soft', 'HEAD@{1}']);
      }),
      switchMap(this.gitRefresh.refreshAll),
    ).subscribe(() => { this.popup.success('Undone'); this.refreshTooltip(); });

  redo = () => {
    const top = this.redoStack().at(-1);
    if (!top) return;
    this.redoStack.update(s => s.slice(0, -1));
    const cmd = top.type === 'checkout'
      ? this.gitApi.git(['checkout', top.branch])
      : this.gitApi.git(['reset', '--soft', top.sha]);
    cmd.pipe(switchMap(this.gitRefresh.refreshAll))
      .subscribe(() => { this.popup.success('Redone'); this.refreshTooltip(); });
  };

}
