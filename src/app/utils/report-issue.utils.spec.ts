import {describe, expect, it} from 'vitest';
import {reportIssueUrl} from './report-issue.utils';

describe('reportIssueUrl', () => {
  it('prefills the environment in the issue body', () => {
    const url = new URL(reportIssueUrl({appVersion: '2.12.0', buildCommit: 'abc123', packageFormat: 'flatpak', platform: 'linux', arch: 'x86_64'}));
    expect(url.origin + url.pathname).toBe('https://github.com/zeuros/gitgud/issues/new');
    const body = url.searchParams.get('body')!;
    expect(body).toContain('- GitGud: 2.12.0 (abc123)');
    expect(body).toContain('- OS: linux x86_64');
    expect(body).toContain('- Package: flatpak');
  });

  it('leaves out the package line when the format is unknown', () => {
    const body = new URL(reportIssueUrl({appVersion: '2.12.0', platform: 'darwin', arch: 'aarch64'})).searchParams.get('body')!;
    expect(body).toContain('- GitGud: 2.12.0\n');
    expect(body).not.toContain('Package');
  });
});
