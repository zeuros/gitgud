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

import {inject, Injectable} from '@angular/core';
import {DialogService} from 'primeng/dynamicdialog';
import {catchError, EMPTY, filter, first, map, type Observable, of, switchMap} from 'rxjs';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {GitApiService} from './git/git-api.service';
import {GitWorkflowService} from './git-workflow.service';
import {BranchAheadBehindService} from './branch-ahead-behind.service';
import {openSetUpstreamDialog} from '../components/dialogs/set-upstream-dialog/set-upstream-dialog.component';
import {type BehindRemoteAction, openBehindRemoteDialog} from '../components/dialogs/behind-remote-dialog/behind-remote-dialog.component';
import {local, parseRemote, type RemoteAndBranch} from '../utils/branch-utils';

interface PushTarget extends RemoteAndBranch {
  // No upstream yet: the push sets it
  setUpstream: boolean;
}

@Injectable({providedIn: 'root'})
export class PushService {

  private currentRepo = inject(CurrentRepoStore);
  private gitApi = inject(GitApiService);
  private gitWorkflow = inject(GitWorkflowService);
  private aheadBehind = inject(BranchAheadBehindService);
  private dialog = inject(DialogService);

  /**
   * Pushes a local branch to its upstream, or where the set-upstream dialog says.
   * Behind that remote branch, git would reject the push: offers to pull, rebase, merge or force push instead.
   */
  push = (localName: string): Observable<unknown> =>
    this.pushTarget(localName).pipe(switchMap(target => this.pushTo(localName, target)));

  /** Fast-forwards a local branch to a remote branch */
  pull = (localName: string, {remote, branch}: RemoteAndBranch) => {
    const upstream = `${remote}/${branch}`;
    const message = `Pulled ${upstream} into ${localName}`;

    // git refuses to fetch into the checked out branch, pull it instead
    return this.currentRepo.headBranch()?.name === localName
      ? this.gitWorkflow.runAndRefresh(['pull', '--ff-only', remote, branch], message)
      : this.gitWorkflow.runAndRefresh(['fetch', remote, `${branch}:${localName}`], message);
  };

  private pushTarget = (localName: string): Observable<PushTarget> => {
    const upstream = this.currentRepo.branches().find(branch => local(branch) && branch.name === localName)?.upstream;
    if (upstream) return of({...parseRemote(upstream), setUpstream: false});

    return openSetUpstreamDialog(this.dialog, localName).pipe(
      first(),
      filter((target): target is RemoteAndBranch => !!target),
      map(target => ({...target, setUpstream: true})),
    );
  };

  private pushTo = (localName: string, target: PushTarget) => {
    const {remote, branch, setUpstream} = target;
    const upstream = `${remote}/${branch}`;
    const pushArgs = (...options: string[]) =>
      ['push', ...options, ...setUpstream ? ['--set-upstream'] : [], remote, `${localName}:${branch}`];

    return this.aheadBehind.aheadBehind(`refs/heads/${localName}`, `refs/remotes/${upstream}`).pipe(
      catchError(() => of({ahead: 0, behind: 0, diverged: false})), // not on the remote yet
      switchMap(({behind, diverged}) => behind === 0
        ? this.gitWorkflow.runAndRefresh(pushArgs(), `Pushed ${localName} to ${upstream}`)
        : this.reconcile(localName, target, diverged).pipe(
          switchMap(action => action === 'force-push'
            ? this.gitWorkflow.runAndRefresh(pushArgs('--force-with-lease'), `Force-pushed ${localName} to ${upstream}`)
            : EMPTY),
        )),
    );
  };

  // Asks how to reconcile with the remote branch and does it; a force push is left to the caller
  private reconcile = (localName: string, target: PushTarget, diverged: boolean): Observable<BehindRemoteAction> => {
    const upstream = `${target.remote}/${target.branch}`;
    const otherWorktreePath = this.currentRepo.otherWorktreeOf(localName);
    // Tracked from now on, as the push would have
    const setUpstream$: Observable<unknown> = target.setUpstream
      ? this.gitApi.gitAction(['branch', `--set-upstream-to=${upstream}`, localName])
      : of(undefined);

    return setUpstream$.pipe(
      switchMap(() => openBehindRemoteDialog(this.dialog, localName, upstream, diverged, otherWorktreePath)),
      switchMap(action => {
        if (action === 'pull') return this.pull(localName, target).pipe(map(() => action));
        if (action === 'rebase') this.gitWorkflow.rebaseBranchOnto(localName, upstream, `Rebased ${localName} onto ${upstream}`);
        if (action === 'merge') this.gitWorkflow.checkoutThenRun(localName, ['merge', '--no-ff', upstream], `Merged ${upstream} into ${localName}`);
        return of(action);
      }),
    );
  };
}
