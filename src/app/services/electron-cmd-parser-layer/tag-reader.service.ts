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
import {GitTag} from '../../models/git-tag';
import {createForEachRefParser} from '../parser.service';

@Injectable({providedIn: 'root'})
export class TagReaderService {

  private readonly gitApi = inject(GitApiService);

  private readonly fields = {
    name: '%(refname:short)',
    sha: '%(*objectname)',       // dereferenced commit sha (annotated tags)
    objectSha: '%(objectname)',  // tag object sha (lightweight tags)
    message: '%(subject)',
  };

  private readonly parser = createForEachRefParser(this.fields);

  getTags = () =>
    this.gitApi.git(['for-each-ref', 'refs/tags', this.parser.formatArg])
      .pipe(map(output =>
        this.parser.parse(output).map((t): GitTag => ({
          name: t.name,
          sha: t.sha || t.objectSha, // annotated tags have dereferenced sha, lightweight don't
          message: t.message || undefined,
        }))
      ));
}
