import {describe, expect, it} from 'vitest';
import {permalink, remoteWebUrl} from './permalink.utils';

describe('permalink', () => {
  it('turns remote urls into web urls', () => {
    expect(remoteWebUrl('git@github.com:zeuros/gitgud.git')).toBe('https://github.com/zeuros/gitgud');
    expect(remoteWebUrl('https://github.com/zeuros/gitgud.git')).toBe('https://github.com/zeuros/gitgud');
    expect(remoteWebUrl('https://user:token@gitlab.com/group/sub/repo')).toBe('https://gitlab.com/group/sub/repo');
    expect(remoteWebUrl('ssh://git@gitlab.example.com:2222/group/repo.git')).toBe('https://gitlab.example.com/group/repo');
    expect(remoteWebUrl('/home/me/bare-repo')).toBeUndefined();
  });

  it('links lines in the format of the host', () => {
    expect(permalink('https://github.com/a/b', 'abc', 'src/my file.ts', 3, 3)).toBe('https://github.com/a/b/blob/abc/src/my%20file.ts#L3');
    expect(permalink('https://github.com/a/b', 'abc', 'f.ts', 3, 8)).toBe('https://github.com/a/b/blob/abc/f.ts#L3-L8');
    expect(permalink('https://gitlab.com/a/b', 'abc', 'f.ts', 3, 8)).toBe('https://gitlab.com/a/b/-/blob/abc/f.ts#L3-8');
    expect(permalink('https://bitbucket.org/a/b', 'abc', 'f.ts', 3, 8)).toBe('https://bitbucket.org/a/b/src/abc/f.ts#lines-3:8');
  });
});
