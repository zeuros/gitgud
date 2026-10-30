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
import {catchError, EMPTY, finalize, interval, map, type Observable, of, switchMap} from 'rxjs';
import {ButtonDirective} from 'primeng/button';
import {Divider} from 'primeng/divider';
import {Tooltip} from 'primeng/tooltip';
import {Menu} from 'primeng/menu';
import type {MenuItem} from 'primeng/api';
import {GitApiService} from '../../services/git/git-api.service';
import {GitRefreshService} from '../../services/git-refresh.service';
import {ToastService} from '../../services/toast.service';
import {AutoFetchService} from '../../services/auto-fetch.service';
import {SettingsService} from '../../services/settings.service';
import {short} from '../../utils/commit-utils';
import {WorktreeBadgeComponent} from '../worktree-badge/worktree-badge.component';
import {workingDirHasChanges} from '../../utils/utils';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {UndoService} from '../../services/undo.service';
import {DialogService} from 'primeng/dynamicdialog';
import {openSetUpstreamDialog} from '../dialogs/set-upstream-dialog/set-upstream-dialog.component';
import {type BehindRemoteAction, openBehindRemoteDialog} from '../dialogs/behind-remote-dialog/behind-remote-dialog.component';
import {BranchAheadBehindService} from '../../services/branch-ahead-behind.service';
import {CreateBranchService} from '../../services/create-branch.service';
import {canSkip, type GitOperation, OPERATION_LABELS} from '../../utils/operation-in-progress.utils';
import {UpdateCheckService} from '../../services/update-check.service';
import {SettingsDialogComponent} from '../dialogs/settings-dialog/settings-dialog.component';
import {ShellHistoryDialogComponent} from '../dialogs/shell-history-dialog/shell-history-dialog.component';
import {recentConsoleMessages, reportIssueUrl} from '../../utils/report-issue.utils';
import {type GitCommandRecord, GitCommandHistoryService} from '../../services/git-command-history.service';

const REPORTED_GIT_COMMANDS = 10;

const gitCommandLine = ({args, timestamp, success}: GitCommandRecord) =>
  `[${timestamp.toISOString()}] ${success ? 'ok' : 'failed'}: git ${args.join(' ')}`;

type ToolbarAction = 'push' | 'pull' | 'fetch' | 'stash' | 'pop' | 'operation-continue' | 'operation-skip' | 'operation-abort';

@Component({
  selector: 'gitgud-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ButtonDirective, Divider, Tooltip, Menu, WorktreeBadgeComponent],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
  // Below the tab strip, its empty space moves the window too
  host: {'data-tauri-drag-region': 'deep'},
})
export class ToolbarComponent implements OnInit {

  protected currentRepo = inject(CurrentRepoStore);
  protected autoFetch = inject(AutoFetchService);
  protected settings = inject(SettingsService);
  protected undo = inject(UndoService);
  protected createBranch = inject(CreateBranchService);
  protected gitRefresh = inject(GitRefreshService);
  protected updateCheck = inject(UpdateCheckService);
  protected loading = signal<ToolbarAction | undefined>(undefined);
  protected hasWorkDirChanges = computed(() => workingDirHasChanges(this.currentRepo.workDirStatus()));
  protected hasStashes = computed(() => this.currentRepo.stashes().length > 0);
  protected short = short;
  protected operationLabel = computed(() => {
    const operation = this.currentRepo.operationInProgress();
    return operation && OPERATION_LABELS[operation];
  });
  protected canSkipOperation = computed(() => {
    const operation = this.currentRepo.operationInProgress();
    return !!operation && canSkip(operation);
  });
  // Nothing left to commit: git refuses to continue and suggests skipping instead
  protected canContinueOperation = computed(() => !this.canSkipOperation() || this.hasWorkDirChanges());
  protected zoomPercent = computed(() => Math.round(this.settings.zoom * 100));
  protected zoomItems = computed<MenuItem[]>(() => [70, 80, 90, 100, 110, 120, 130, 140, 150].map(percent => ({
    label: `${percent}%`,
    icon: percent === this.zoomPercent() ? 'pi pi-check' : 'pi pi-fw',
    command: () => {
      this.settings.zoom = percent / 100;
    },
  })));
  private gitApi = inject(GitApiService);
  private branchAheadBehind = inject(BranchAheadBehindService);
  private toast = inject(ToastService);
  private dialog = inject(DialogService);
  private gitCommandHistory = inject(GitCommandHistoryService);
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
    if (secs < 60) return `${Math.max(0, secs)}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  });

  ngOnInit() {
    this.undo.refreshTooltip();
  }

  protected push = () => this.runAction('push', this.upstreamMatchesLocal().pipe(
    switchMap(ok => ok ? this.checkBehindThenPush() : this.openSetUpstreamDialog()),
  ), () => this.toast.success('Pushed successfully'));

  protected pull = () => this.runAction('pull', this.gitApi.gitAction(['pull']), () => this.toast.success('Pulled successfully'));

  protected stash = () => this.runAction('stash', this.gitApi.gitAction(['stash', '-u']), () => this.toast.success('Stashed successfully'));

  protected pop = () => this.runAction('pop', this.gitApi.gitAction(['stash', 'pop']), () => this.toast.success('Stash popped successfully'));

  // --prune also forgets the branches deleted on the remote
  protected fetch = () => this.runAction('fetch', this.gitApi.gitAction(['fetch', '--prune']), () => this.autoFetch.lastFetchedAt.set(Date.now()));

  protected continueOperation = () => this.runOperationAction('continue', operation => `${OPERATION_LABELS[operation]} continued`);

  protected skipOperation = () => this.runOperationAction('skip', () => 'Commit skipped');

  protected abortOperation = () => this.runOperationAction('abort', operation => `${OPERATION_LABELS[operation]} aborted`);

  // `git <operation> --<step>` on the operation stopped in progress
  private runOperationAction = (step: 'continue' | 'skip' | 'abort', successMessage: (operation: GitOperation) => string) => {
    const operation = this.currentRepo.operationInProgress();
    if (!operation) return;
    this.runAction(`operation-${step}`, this.gitApi.gitAction([operation, `--${step}`]), () => this.toast.success(successMessage(operation)));
  };

  // Shows a loader while running action
  private runAction = (key: ToolbarAction, action$: Observable<unknown>, onSuccess: () => void) => {
    this.loading.set(key);
    action$.pipe(finalize(() => {
      this.loading.set(undefined);
      this.gitRefresh.doRefreshAll();
    })).subscribe(onSuccess);
  };

  // Returns false when there is no upstream or the upstream branch name differs from the local branch name.

  protected openSettingsDialog = () => this.dialog.open(SettingsDialogComponent, {header: 'Settings', width: '460px'});

  protected reportIssue = () => window.tauri.openExternal(reportIssueUrl({
    appVersion: window.tauri.appVersion,
    buildCommit: window.tauri.buildCommit,
    packageFormat: window.tauri.packageFormat,
    platform: window.tauri.process.platform,
    arch: window.tauri.process.arch,
  }, {
    gitCommands: this.gitCommandHistory.history().slice(0, REPORTED_GIT_COMMANDS).reverse().map(gitCommandLine),
    consoleMessages: recentConsoleMessages(),
  }));

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
