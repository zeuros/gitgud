import {inject, Injectable} from '@angular/core';
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

  showCommittedFileDiffs = (f: CommittedFileChange) => this.fileToDiffSubject$.next(f);

  showWorkingDirDiffs = (f: WorkingDirectoryFileChange) => this.fileToDiffSubject$.next(f);

  close = () => this.fileToDiffSubject$.next(null);

}
