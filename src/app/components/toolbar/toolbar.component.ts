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

import {ChangeDetectionStrategy, Component, computed, inject, type OnInit, signal} from '@angular/core';
import {toObservable, toSignal} from '@angular/core/rxjs-interop';
import {catchError, EMPTY, finalize, interval, map, of, switchMap} from 'rxjs';
import {Button} from 'primeng/button';
import {Divider} from 'primeng/divider';
import {Tooltip} from 'primeng/tooltip';
import {Select} from 'primeng/select';
import {FormsModule} from '@angular/forms';
import {Menu} from 'primeng/menu';
import {type MenuItem, PrimeTemplate} from 'primeng/api';
import {GitApiService} from '../../services/electron-cmd-parser-layer/git-api.service';
import {GitRefreshService} from '../../services/git-refresh.service';
import {ToastService} from '../../services/toast.service';
import {AutoFetchService} from '../../services/auto-fetch.service';
import {SettingsService} from '../../services/settings.service';
import {short} from '../../utils/commit-utils';
import {workingDirHasChanges} from '../../utils/utils';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {UndoService} from '../../services/undo.service';
import {DialogService} from 'primeng/dynamicdialog';
import {openSetUpstreamDialog} from '../dialogs/set-upstream-dialog/set-upstream-dialog.component';
import {type BehindRemoteAction, openBehindRemoteDialog} from '../dialogs/behind-remote-dialog/behind-remote-dialog.component';
import {BranchAheadBehindService} from '../../services/branch-ahead-behind.service';
import {CreateBranchService} from '../../services/create-branch.service';
import {RebaseService} from '../../services/rebase.service';
import {UpdateCheckService} from '../../services/update-check.service';
import {openCloneDialog} from '../dialogs/clone-dialog/clone-dialog.component';
import {SettingsDialogComponent} from '../dialogs/settings-dialog/settings-dialog.component';
import {ShellHistoryDialogComponent} from '../dialogs/shell-history-dialog/shell-history-dialog.component';

@Component({
  selector: 'gitgud-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Button, Divider, Tooltip, Select, FormsModule, PrimeTemplate, Menu],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
})
export class ToolbarComponent implements OnInit {

  protected currentRepo = inject(CurrentRepoStore);
  protected autoFetch = inject(AutoFetchService);
  protected settings = inject(SettingsService);
  protected undo = inject(UndoService);
  protected createBranch = inject(CreateBranchService);
  protected gitRefresh = inject(GitRefreshService);
  protected updateCheck = inject(UpdateCheckService);
  protected rebase = inject(RebaseService);
  protected loading = signal<'push' | 'pull' | 'fetch' | 'stash' | 'pop' | 'rebase-continue' | 'rebase-skip' | 'rebase-abort' | undefined>(undefined);
  protected hasWorkDirChanges = computed(() => workingDirHasChanges(this.currentRepo.workDirStatus()));
  protected hasStashes = computed(() => this.currentRepo.stashes().length > 0);
  protected short = short;
  protected zoomLevels = [70, 80, 90, 100, 110, 120, 130, 140, 150].map(v => ({label: `${v}%`, value: v / 100}));
  private gitApi = inject(GitApiService);
  private branchAheadBehind = inject(BranchAheadBehindService);
  private toast = inject(ToastService);
  private dialog = inject(DialogService);
  private now = toSignal(
    toObservable(this.autoFetch.lastFetchedAt).pipe(
      switchMap(at => at ? interval(1000).pipe(map(() => Date.now())) : EMPTY),
    ),
    {initialValue: Date.now()},
  );
  protected fetchedAgo = computed(() => {
    const at = this.autoFetch.lastFetchedAt();
    if (!at) return undefined;
    const secs = Math.floor((this.now()! - at) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  });

  ngOnInit() {
    this.undo.refreshTooltip();
  }

  protected push = () => {
    this.loading.set('push');
    this.upstreamMatchesLocal().pipe(
      switchMap(ok => ok ? this.checkBehindThenPush() : this.openSetUpstreamDialog()),
      switchMap(this.gitRefresh.refreshAll),
      finalize(() => this.loading.set(undefined)),
    ).subscribe(() => {
      this.toast.success('Pushed successfully');
      this.undo.clearRedoStack();
    });
  };

  protected pull = () => {
    this.loading.set('pull');
    this.gitApi.gitAction(['pull'])
      .pipe(switchMap(this.gitRefresh.refreshAll), finalize(() => this.loading.set(undefined)))
      .subscribe(() => {
        this.toast.success('Pulled successfully');
        this.undo.clearRedoStack();
        this.undo.refreshTooltip();
      });
  };

  protected stash = () => {
    this.loading.set('stash');
    this.gitApi.gitAction(['stash', '-u'])
      .pipe(switchMap(this.gitRefresh.refreshAll), finalize(() => this.loading.set(undefined)))
      .subscribe(() => this.toast.success('Stashed successfully'));
  };

  protected pop = () => {
    this.loading.set('pop');
    this.gitApi.gitAction(['stash', 'pop'])
      .pipe(switchMap(this.gitRefresh.refreshAll), finalize(() => this.loading.set(undefined)))
      .subscribe(() => this.toast.success('Stash popped successfully'));
  };

  protected fetch = () => {
    this.loading.set('fetch');
    this.gitApi.gitAction(['fetch'])
      .pipe(switchMap(this.gitRefresh.refreshAll), finalize(() => this.loading.set(undefined)))
      .subscribe(() => this.autoFetch.lastFetchedAt.set(Date.now()));
  };

  protected continueRebase = () => {
    this.loading.set('rebase-continue');
    this.gitApi.gitAction(['rebase', '--continue'])
      .pipe(finalize(() => { this.loading.set(undefined); this.gitRefresh.doRefreshAll(); }))
      .subscribe(() => this.toast.success('Rebase continued'));
  };

  protected skipRebase = () => {
    this.loading.set('rebase-skip');
    this.gitApi.gitAction(['rebase', '--skip'])
      .pipe(finalize(() => { this.loading.set(undefined); this.gitRefresh.doRefreshAll(); }))
      .subscribe(() => this.toast.success('Commit skipped'));
  };

  protected abortRebase = () => {
    this.loading.set('rebase-abort');
    this.rebase.abortRebase()
      .pipe(finalize(() => { this.loading.set(undefined); this.gitRefresh.doRefreshAll(); }))
      .subscribe(() => this.toast.success('Rebase aborted'));
  };

  // Returns false when there is no upstream or the upstream branch name differs from the local branch name.

  protected openSettingsDialog = () => this.dialog.open(SettingsDialogComponent, {header: 'Settings', width: '460px'});

  protected openCloneDialog = () => openCloneDialog(this.dialog);

  protected openShellHistoryDialog = () => this.dialog.open(ShellHistoryDialogComponent, {header: 'Git Command History', width: '700px'});

  private checkBehindThenPush = () =>
    this.branchAheadBehind.aheadBehindForHead().pipe(
      switchMap(({behind, diverged}) =>
        behind === 0 ? this.gitApi.gitAction(['push']) : this.openBehindRemoteDialog(diverged)
      ),
    );

  private openBehindRemoteDialog = (diverged: boolean) => {
    const branch = this.currentRepo.headBranch()!;
    return openBehindRemoteDialog(this.dialog, branch.ref, `refs/remotes/${branch.upstream}`, diverged).pipe(
      switchMap((action: BehindRemoteAction) => {
        if (action === 'pull') return this.gitApi.gitAction(['pull', '--ff-only']);
        if (action === 'merge') return this.gitApi.gitAction(['pull', '--no-ff']);
        if (action === 'rebase') return this.gitApi.gitAction(['pull', '--rebase']);
        if (action === 'force-push') return this.gitApi.gitAction(['push', '--force-with-lease']);
        return EMPTY;
      }),
    );
  };

  // Uses rev-parse @{u} — plumbing output (refs only), locale-independent.
  private upstreamMatchesLocal = () => {
    const localBranch = this.currentRepo.headBranch()?.name;
    if (!localBranch) return of(true); // detached HEAD — let git decide
    return this.gitApi.git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).pipe(
      map(out => out.trim().split('/').slice(1).join('/') === localBranch),
      catchError(() => of(false)), // @{u} fails when no upstream is configured
    );
  };

  private openSetUpstreamDialog = () =>
    openSetUpstreamDialog(this.dialog, this.currentRepo.headBranch()?.name ?? '').pipe(
      switchMap(result => result ? this.gitApi.gitAction(['push', '--set-upstream', result.remote, result.branch]) : EMPTY),
    );

  protected donateItems: MenuItem[] = [
    {
      label: 'Liberapay',
      icon: 'fa fa-heart',
      command: () => window.tauri.openExternal('https://liberapay.com/zeuros/donate'),
    },
    {
      label: 'Bitcoin — copy address',
      icon: 'fa fa-bitcoin',
      command: () => navigator.clipboard.writeText('bc1q6kpuaygvp2a0mnv6n74jg4dlcggw35llynm3p9')
        .then(() => this.toast.success('BTC address copied to clipboard')),
    },
  ];
}
