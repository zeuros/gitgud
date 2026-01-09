import {Injectable} from '@angular/core';

import * as chokidar from 'chokidar';
import {debounceTime, Subject} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FileWatcherService {

  private chokidar: typeof chokidar = (window as any).require('chokidar');
  private watcher?: chokidar.FSWatcher;
  private fileChangeSubject$ = new Subject<string>();

  onWorkingDirFileChange$ = this.fileChangeSubject$.pipe(debounceTime(50));

  setWatcher = (projectPath: string) => {

    // Remove existing watcher if any
    this.watcher?.close();

    // Watch a project's files changes
    this.watcher = this.makeWatcher(projectPath);
  };

  private makeWatcher = (projectPath: string) =>
    this.chokidar
      .watch(projectPath, {
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
      .on('add', f => this.fileChangeSubject$.next(f))
      .on('change', f => this.fileChangeSubject$.next(f))
      .on('unlink', f => this.fileChangeSubject$.next(f))
      .on('error', console.error);

}
