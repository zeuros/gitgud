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
import {CommittedFileChange, FileChange} from '../lib/github-desktop/model/status';
import {EMPTY, map, of, Subject, switchMap} from 'rxjs';
import {instanceOf} from '../utils/utils';
import {CurrentRepoStore} from '../stores/current-repo.store';
import {WorkingDirectoryFileChange} from "../lib/github-desktop/model/workdir";
import {toObservable} from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class FileDiffPanelService {


  private currentRepo = inject(CurrentRepoStore);
  private fileToDiffSubject$ = new Subject<FileChange | null>();
  private workDirStatus$ = toObservable(this.currentRepo.workDirStatus);

  // Here we update monaco view for commit files (no live changes) or for working dir changes (live update on file change)
  fileToDiff$ = this.fileToDiffSubject$.pipe(
    switchMap(file => {

      // Explicit null → emit null
      if (!file) return of(file);

      // Committed file → emit once, file won't change
      if (instanceOf(file, CommittedFileChange)) return of(file);

      // Working directory file → re-emit on every working dir status change (staging, file saves, etc.)
      if (instanceOf(file, WorkingDirectoryFileChange))
        return this.workDirStatus$.pipe(map(() => ({...file})));

      return EMPTY;
    }),
  );

  selectedFile = signal<FileChange | null>(null);

  showCommittedFileDiffs = (f: CommittedFileChange) => { this.selectedFile.set(f); this.fileToDiffSubject$.next(f); };

  showWorkingDirDiffs = (f: WorkingDirectoryFileChange) => { this.selectedFile.set(f); this.fileToDiffSubject$.next(f); };

  close = () => { this.selectedFile.set(null); this.fileToDiffSubject$.next(null); };

}
