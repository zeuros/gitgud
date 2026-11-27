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
import {EMPTY, finalize, interval, map, type Observable, switchMap} from 'rxjs';
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
import {CreateBranchService} from '../../services/create-branch.service';
import {canSkip, type GitOperation, OPERATION_LABELS} from '../../utils/operation-in-progress.utils';
import {UpdateCheckService} from '../../services/update-check.service';
import {PushService} from '../../services/push.service';
import {SettingsDialogComponent} from '../dialogs/settings-dialog/settings-dialog.component';
import {ShellHistoryDialogComponent} from '../dialogs/shell-history-dialog/shell-history-dialog.component';
import {recentConsoleMessages, reportIssueUrl} from '../../utils/report-issue.utils';
import {type GitCommandRecord, GitCommandHistoryService} from '../../services/git-command-history.service';
import {isTextInput, shortcutLabel, shortcutMatches} from '../../utils/menu-shortcuts';

const REPORTED_GIT_COMMANDS = 10;

const gitCommandLine = ({args, timestamp, success}: GitCommandRecord) =>
  `[${timestamp.toISOString()}] ${success ? 'ok' : 'failed'}: git ${args.join(' ')}`;

export const TOOLBAR_SHORTCUTS = {
  push: 'Ctrl+P',
  pull: 'Ctrl+Shift+P',
  fetch: 'Ctrl+Shift+F',
  stash: 'Ctrl+Shift+S',
  pop: 'Ctrl+Shift+U',
  createBranch: 'Ctrl+Shift+N',
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Shift+Z',
  redoAlternative: 'Ctrl+Y',
  refresh: 'F5',
  gitCommandHistory: 'Ctrl+Shift+H',
  settings: 'Ctrl+,',
} as const;

const ZOOM_PERCENTS = [70, 80, 90, 100, 110, 120, 130, 140, 150];

interface ShortcutAction {
  shortcuts: string[];
  enabled: boolean;
  run: () => void;
}

type ToolbarAction = 'push' | 'pull' | 'fetch' | 'stash' | 'pop' | 'operation-continue' | 'operation-skip' | 'operation-abort';

@Component({
  selector: 'gitgud-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ButtonDirective, Divider, Tooltip, Menu, WorktreeBadgeComponent],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
  // Below the tab strip, its empty space moves the window too
  host: {'data-tauri-drag-region': 'deep', '(document:keydown)': 'onKeydown($event)'},
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
  protected zoomItems = computed<MenuItem[]>(() => ZOOM_PERCENTS.map(percent => ({
    label: `${percent}%`,
    icon: percent === this.zoomPercent() ? 'pi pi-check' : 'pi pi-fw',
    command: () => {
      this.settings.zoom = percent / 100;
    },
  })));
  private gitApi = inject(GitApiService);
  private pushService = inject(PushService);
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

  protected readonly TOOLBAR_SHORTCUTS = TOOLBAR_SHORTCUTS;
  protected withShortcut = (tooltip: string, shortcut: string) => `${tooltip} (${shortcutLabel(shortcut)})`;

  ngOnInit() {
    this.undo.refreshTooltip();
  }

  // The toolbar's buttons from the keyboard, outside text fields and dialogs. A disabled button's shortcut does nothing
  protected onKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || isTextInput(event.target) || document.querySelector('.p-dialog')) return;
    const action = this.shortcutActions().find(({shortcuts}) => shortcuts.some(shortcut => shortcutMatches(shortcut, event)))
      ?? this.zoomShortcut(event);
    if (!action) return;

    event.preventDefault();
    if (action.enabled) action.run();
  };

  private shortcutActions = (): ShortcutAction[] => {
    const idle = !this.loading();
    const headSha = this.currentRepo.headSha();
    return [
      {shortcuts: [TOOLBAR_SHORTCUTS.push], enabled: idle, run: this.push},
      {shortcuts: [TOOLBAR_SHORTCUTS.pull], enabled: idle, run: this.pull},
      {shortcuts: [TOOLBAR_SHORTCUTS.fetch], enabled: idle, run: this.fetch},
      {shortcuts: [TOOLBAR_SHORTCUTS.stash], enabled: idle && this.hasWorkDirChanges(), run: this.stash},
      {shortcuts: [TOOLBAR_SHORTCUTS.pop], enabled: idle && this.hasStashes(), run: this.pop},
      {shortcuts: [TOOLBAR_SHORTCUTS.createBranch], enabled: !!headSha, run: () => this.createBranch.createBranchAtSha(headSha!)},
      {shortcuts: [TOOLBAR_SHORTCUTS.undo], enabled: this.undo.undoAvailable(), run: this.undo.undo},
      {shortcuts: [TOOLBAR_SHORTCUTS.redo, TOOLBAR_SHORTCUTS.redoAlternative], enabled: this.undo.redoAvailable(), run: this.undo.redo},
      {shortcuts: [TOOLBAR_SHORTCUTS.refresh], enabled: true, run: this.gitRefresh.doRefreshAll},
      {shortcuts: [TOOLBAR_SHORTCUTS.gitCommandHistory], enabled: true, run: this.openShellHistoryDialog},
      {shortcuts: [TOOLBAR_SHORTCUTS.settings], enabled: true, run: this.openSettingsDialog},
    ];
  };

  // Ctrl+= / Ctrl++ and Ctrl+- step through the zoom menu's levels, Ctrl+0 goes back to 100%
  private zoomShortcut = (event: KeyboardEvent): ShortcutAction | undefined => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return undefined;
    const current = ZOOM_PERCENTS.indexOf(this.zoomPercent());
    const step = {'=': 1, '+': 1, '-': -1}[event.key];
    const percent = event.key == '0' ? 100 : step && ZOOM_PERCENTS[Math.min(ZOOM_PERCENTS.length - 1, Math.max(0, (current < 0 ? 3 : current) + step))];
    return percent ? {shortcuts: [], enabled: true, run: () => {
      this.settings.zoom = percent / 100;
    }} : undefined;
  };

  // Detached HEAD: git decides
  protected push = () => {
    const localName = this.currentRepo.headBranch()?.name;
    if (localName) this.runAction('push', this.pushService.push(localName), () => undefined);
    else this.runAction('push', this.gitApi.gitAction(['push']), () => this.toast.success('Pushed successfully'));
  };

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
