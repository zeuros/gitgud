import {Injectable} from '@angular/core';
import {CommittedFileChange, FileChange, WorkingDirectoryFileChange} from '../lib/github-desktop/model/status';
import {Subject} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FileDiffPanelService {

  showCommittedFileDiffs = (f: CommittedFileChange) => this.fileToDiff$.next(f);
  showWorkingDirDiffs = (f: WorkingDirectoryFileChange) => this.fileToDiff$.next(f);

  fileToDiff$ = new Subject<FileChange>();

}
