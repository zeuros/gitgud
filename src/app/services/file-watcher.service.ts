import {Injectable} from '@angular/core';
import {debounceTime, Subject} from 'rxjs';
import {createWatcher} from '../utils/file-watcher.utils';

@Injectable({
  providedIn: 'root',
})
export class FileWatcherService {

  private watcher?: ReturnType<typeof createWatcher>;
  private fileChangeSubject$ = new Subject<string>();

  onWorkingDirFileChange$ = this.fileChangeSubject$.pipe(debounceTime(50));

  readonly setWatcher = (projectPath: string) => {

    // Remove existing watcher if any
    this.watcher?.close();

    // Watch a project's files changes
    this.watcher = this.makeWatcher(projectPath);
  };

  private makeWatcher = (projectPath: string) =>
    createWatcher(projectPath, projectPath, {
      ignored: [
        // Regex-based ignore (more reliable than globs (for Winsh**).
        // Ignores common tool/IDE directories and temp files:
        //   - .git (e.g. .git/FETCH_HEAD)
        //   - .idea/workspace.xml
        //   - node_modules, dist, build, tmp
        //   - editor/temp files: *.swp, *.swo, *~
        // Matches full path segments and supports both / and \ separators.
        /(^|[\/\\])(\.git|\.idea\/workspace\.xml|node_modules|dist|build|cache|tmp)([\/\\]|$)|\.swp$|\.swo$|~$/,
        '**/~*', // Ignore temporary files (e.g., ~ files from editors)
        '**/.DS_Store', // Ignore macOS system files
      ],
      followSymlinks: false,
      persistent: true,
      ignoreInitial: true, // Skip the initial "add" event for all files
      depth: 99, // Watch all subdirectories
      ignorePermissionErrors: true,
      awaitWriteFinish: {
        stabilityThreshold: 100, // Wait 100ms for file stability
        pollInterval: 100,
      },
    })
      .on('add', f => this.fileChangeSubject$.next(String(f)))
      .on('change', f => this.fileChangeSubject$.next(String(f)))
      .on('unlink', f => this.fileChangeSubject$.next(String(f)))
      .on('error', console.error);

}
