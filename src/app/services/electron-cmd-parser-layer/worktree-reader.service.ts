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
import {map} from 'rxjs';
import {GitApiService} from './git-api.service';
import {type GitWorktree} from '../../models/git-worktree';

@Injectable({providedIn: 'root'})
export class WorktreeReaderService {

  private gitApi = inject(GitApiService);

  getWorktrees = () =>
    this.gitApi.git(['worktree', 'list', '--porcelain']).pipe(
      map(output => {
        const blocks = output.trim().split(/\n\n+/);
        return blocks
          .filter(block => block.trim())
          .map((block, idx): GitWorktree => {
            const lines = block.split('\n');
            const path = lines.find(l => l.startsWith('worktree '))?.slice('worktree '.length) ?? '';
            const sha = lines.find(l => l.startsWith('HEAD '))?.slice('HEAD '.length) ?? '';
            const branchLine = lines.find(l => l.startsWith('branch '));
            const isDetached = lines.some(l => l === 'detached');
            const lockedLine = lines.find(l => l.startsWith('locked'));
            const branch = branchLine?.slice('branch '.length).replace(/^refs\/heads\//, '');
            const lockReason = lockedLine && lockedLine.length > 'locked'.length
              ? lockedLine.slice('locked '.length)
              : undefined;
            return {path, sha, branch, isDetached, isMain: idx === 0, isLocked: !!lockedLine, lockReason};
          });
      }),
    );
}
