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
import {createForEachRefParser} from '../parser.service';
import {CommitIdentity} from '../../lib/github-desktop/model/commit-identity';
import {Branch, BranchType, IBranchTip} from '../../lib/github-desktop/model/branch';
import {catchError, map, Observable} from 'rxjs';
import {PREFIXES} from '../../utils/constants';
import {GitApiService} from './git-api.service';
import {PopupService} from '../popup.service';

@Injectable({
  providedIn: 'root',
})
export class BranchReaderService {

  fields = {
    fullName: '%(refname)',
    shortName: '%(refname:short)',
    upstreamShortName: '%(upstream:short)',
    sha: '%(objectname)',
    author: '%(author)',
    symRef: '%(symref)',
    head: '%(HEAD)',
  };

  private parser = createForEachRefParser(this.fields);
  remoteHeadPointer?: string;

  private popupService = inject(PopupService);
  private gitApi = inject(GitApiService);

  getBranches = (): Observable<Branch[]> =>
    this.gitApi.git(['for-each-ref', ...PREFIXES, this.parser.formatArg])
      .pipe(map(result =>

        this.parser.parse(result)
          .map(branch => {

            // Exclude symbolic refs from the branch list (but use it to guess the origin/HEAD branch)
            // Also exclude local HEAD branch since we have the %(HEAD) field to get this info
            if (branch.symRef.length > 0 || branch.fullName == 'refs/heads/origin/HEAD') {
              if (branch.fullName.includes('refs/remotes/origin/HEAD'))
                this.remoteHeadPointer = branch.symRef;

              return undefined;
            }

            const author = CommitIdentity.parseIdentity(branch.author);
            const tip: IBranchTip = {sha: branch.sha, author};

            const type = branch.fullName.startsWith('refs/heads') ? BranchType.Local : BranchType.Remote;

            const upstream = branch.upstreamShortName.length > 0 ? branch.upstreamShortName : null;

            return new Branch(branch.shortName, upstream, tip, type, branch.fullName, branch.head == '*');
          })
          .filter((v): v is Branch => !!v) // Clean symRef branch
          .map(branch => { // If a branch is pointed by origin/HEAD or HEAD, store the info into branch.
            if (branch.ref == this.remoteHeadPointer) // if branch origin/main is pointed by origin/HEAD
              return {...branch, isHeadPointed: true};

            return branch;
          }),
      ));

  detachedHeadSha = () =>
    this.gitApi.git(['symbolic-ref', 'HEAD']).pipe(
      map(() => undefined),
      catchError(() => this.gitApi.git(['rev-parse', 'HEAD']).pipe(map(sha => sha.trim()))),
    );

  checkoutBranch = (branch: Branch) => {
    if (branch.isHeadPointed) {
      this.popupService.warn(`Branch ${branch.name} is already checked out`);
      return;
    }

    if (branch.type === BranchType.Local) {
      this.gitApi.git(['checkout', branch.name]).subscribe();
      return;
    }

    const localName = branch.name.replace(/^origin\//, '');
    this.gitApi.git(['checkout', localName]).pipe(
      // If the branch exists remotely only, we check it out and track it
      catchError(() => this.gitApi.git(['checkout', '-b', localName, '--track', `origin/${localName}`])),
    ).subscribe();
  };
}
