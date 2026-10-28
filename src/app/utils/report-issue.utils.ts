export interface EnvironmentInfo {
  appVersion: string;
  buildCommit?: string;
  packageFormat?: string;
  platform: string;
  arch: string;
}

const ISSUE_URL = 'https://github.com/zeuros/gitgud/issues/new';
// GitHub rejects longer new-issue urls
const MAX_ISSUE_URL_LENGTH = 8000;
const MAX_CONSOLE_MESSAGES = 50;
const MAX_CONSOLE_MESSAGE_LENGTH = 1000;

const consoleMessages: string[] = [];

const formatConsoleArg = (arg: unknown) => {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.stack ?? `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
};

const consoleMessage = (level: 'warn' | 'error', args: unknown[]) =>
  `[${new Date().toISOString()}] ${level}: ${args.map(formatConsoleArg).join(' ')}`.slice(0, MAX_CONSOLE_MESSAGE_LENGTH);

// Keeps the last console warnings and errors, to join them to an issue report
export const captureConsoleMessages = () => (['warn', 'error'] as const).forEach(level => {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    consoleMessages.push(consoleMessage(level, args));
    if (consoleMessages.length > MAX_CONSOLE_MESSAGES) consoleMessages.shift();
    original(...args);
  };
});

export const recentConsoleMessages = () => [...consoleMessages];

const issueBody = ({appVersion, buildCommit, packageFormat, platform, arch}: EnvironmentInfo, messages: string[]) => [
  '### What happened',
  '',
  '',
  '### Steps to reproduce',
  '',
  '1. ',
  '',
  '### Expected behavior',
  '',
  '',
  '### Environment',
  '',
  `- GitGud: ${appVersion}${buildCommit ? ` (${buildCommit})` : ''}`,
  `- OS: ${platform} ${arch}`,
  ...(packageFormat ? [`- Package: ${packageFormat}`] : []),
  ...(messages.length ? ['', '### Console warnings and errors', '', '```text', ...messages, '```'] : []),
].join('\n');

// New GitHub issue with a template body, the app's environment and its latest console messages, oldest ones left out to fit the url
export const reportIssueUrl = (environment: EnvironmentInfo, messages: string[] = []) => {
  for (let first = 0; ; first++) {
    const url = `${ISSUE_URL}?body=${encodeURIComponent(issueBody(environment, messages.slice(first)))}`;
    if (url.length <= MAX_ISSUE_URL_LENGTH || first >= messages.length) return url;
  }
};
