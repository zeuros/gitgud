import {describe, expect, it} from 'vitest';
import {reportIssueUrl} from './report-issue.utils';

const environment = {appVersion: '2.12.0', buildCommit: 'abc123', packageFormat: 'flatpak', platform: 'linux', arch: 'x86_64'};
const bodyOf = (url: string) => new URL(url).searchParams.get('body')!;

describe('reportIssueUrl', () => {
  it('prefills the environment in the issue body', () => {
    const url = new URL(reportIssueUrl(environment));
    expect(url.origin + url.pathname).toBe('https://github.com/zeuros/gitgud/issues/new');
    const body = bodyOf(url.href);
    expect(body).toContain('- GitGud: 2.12.0 (abc123)');
    expect(body).toContain('- OS: linux x86_64');
    expect(body).toContain('- Package: flatpak');
    expect(body).not.toContain('Console');
  });

  it('leaves out the package line when the format is unknown', () => {
    const body = bodyOf(reportIssueUrl({appVersion: '2.12.0', platform: 'darwin', arch: 'aarch64'}));
    expect(body).toContain('- GitGud: 2.12.0\n');
    expect(body).not.toContain('Package');
  });

  it('adds the console messages', () => {
    const body = bodyOf(reportIssueUrl(environment, {consoleMessages: ['warn: a', 'error: b']}));
    expect(body).toContain('### Console warnings and errors\n\n```text\nwarn: a\nerror: b\n```');
  });

  it('leaves out the oldest console messages to fit the url', () => {
    const messages = Array.from({length: 50}, (_, index) => `error ${index}: ${'x'.repeat(500)}`);
    const url = reportIssueUrl(environment, {consoleMessages: messages});
    expect(url.length).toBeLessThanOrEqual(8000);
    expect(bodyOf(url)).not.toContain('error 0:');
    expect(bodyOf(url)).toContain('error 49:');
  });

  it('adds the git commands before the console messages', () => {
    const body = bodyOf(reportIssueUrl(environment, {gitCommands: ['git push'], consoleMessages: ['error: b']}));
    expect(body).toContain('### Recent git commands\n\n```text\ngit push\n```\n\n### Console warnings and errors');
  });

  it('leaves out the console messages before the git commands to fit the url', () => {
    const gitCommands = Array.from({length: 10}, (_, index) => `git commit ${index}`);
    const consoleMessages = Array.from({length: 20}, (_, index) => `error ${index}: ${'x'.repeat(1000)}`);
    const url = reportIssueUrl(environment, {gitCommands, consoleMessages});
    expect(url.length).toBeLessThanOrEqual(8000);
    expect(bodyOf(url)).toContain('git commit 0');
    expect(bodyOf(url)).not.toContain('error 0:');
    expect(bodyOf(url)).toContain('error 19:');
  });
});
