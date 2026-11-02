import {describe, expect, it} from 'vitest';
import {watchErrorMessage} from './file-watcher.utils';

describe('watchErrorMessage', () => {
  it('names the inotify limit, its value and how to raise it', () => {
    const message = watchErrorMessage('/home/me/big-repo', {kind: 'watch-limit', message: 'OS file watch limit reached.', watchLimit: 8192});
    expect(message).toContain("Can't watch every folder of big-repo");
    expect(message).toContain('fs.inotify.max_user_watches = 8192');
    expect(message).toContain('sudo sysctl fs.inotify.max_user_watches=524288');
  });

  it('gives the error of another failure', () => {
    expect(watchErrorMessage('/home/me/repo', {kind: 'other', message: 'No such file or directory'}))
      .toMatch(/^Can't watch the files of repo: No such file or directory\. Until then/);
  });
});
