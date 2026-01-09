import {inject, Injectable} from '@angular/core';
import {CommittedFileChange, FileChange, WorkingDirectoryFileChange} from '../lib/github-desktop/model/status';
import {EMPTY, map, of, Subject, switchMap} from 'rxjs';
import {CommitFilesChangesService} from './electron-cmd-parser-layer/commit-files-changes.service';
import {instanceOf} from '../utils/utils';

@Injectable({
  providedIn: 'root',
})
export class FileDiffPanelService {

  private readonly commitFilesChangesService = inject(CommitFilesChangesService);
  private fileToDiffSubject$ = new Subject<FileChange | null>();

  // Here we update monaco view for commit files (no live changes) or for working dir changes (live update on file change)
  fileToDiff$ = this.fileToDiffSubject$.pipe(
    switchMap(file => {

      // Explicit null → emit null
      if (!file) return of(file);

      // Committed file → emit once, file won't change
      if (instanceOf(file, CommittedFileChange)) return of(file);

      // Working directory file → re-emit on file diff update
      if (instanceOf(file, WorkingDirectoryFileChange))
        return this.commitFilesChangesService.workingDirChanges$.pipe(map(() => ({...file}))); // force new reference to update editor on file change

      return EMPTY;
    }),
  );

  showCommittedFileDiffs = (f: CommittedFileChange) => this.fileToDiffSubject$.next(f);

  showWorkingDirDiffs = (f: WorkingDirectoryFileChange) => this.fileToDiffSubject$.next(f);

}
