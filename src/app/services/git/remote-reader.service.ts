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
import type {GitRemote} from '../../models/git-remote';

// 'origin\tgit@github.com:user/repo.git (fetch)' lines => one entry per remote
export const parseRemotes = (output: string): GitRemote[] =>
  output.split('\n')
    .map(line => line.match(/^(\S+)\t(.*) \(fetch\)$/))
    .filter(match => !!match)
    .map(([, name, url]) => ({name, url}));

@Injectable({providedIn: 'root'})
export class RemoteReaderService {
  private gitApi = inject(GitApiService);

  getRemotes = () => this.gitApi.git(['remote', '-v']).pipe(map(parseRemotes));
}
