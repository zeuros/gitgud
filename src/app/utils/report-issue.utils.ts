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

export interface IssueLogs {
  gitCommands?: string[];
  consoleMessages?: string[];
}

const logSection = (title: string, lines: string[]) => lines.length ? ['', `### ${title}`, '', '```text', ...lines, '```'] : [];

const issueBody = ({appVersion, buildCommit, packageFormat, platform, arch}: EnvironmentInfo, {gitCommands = [], consoleMessages = []}: IssueLogs) => [
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
  ...logSection('Recent git commands', gitCommands),
  ...logSection('Console warnings and errors', consoleMessages),
].join('\n');

const issueUrl = (environment: EnvironmentInfo, logs: IssueLogs) => `${ISSUE_URL}?body=${encodeURIComponent(issueBody(environment, logs))}`;

// New GitHub issue with a template body, the app's environment and its latest logs.
// To fit the url, the oldest console messages are left out first, then the oldest git commands
export const reportIssueUrl = (environment: EnvironmentInfo, {gitCommands = [], consoleMessages = []}: IssueLogs = {}) => {
  for (let firstConsoleMessage = 0; firstConsoleMessage < consoleMessages.length; firstConsoleMessage++) {
    const url = issueUrl(environment, {gitCommands, consoleMessages: consoleMessages.slice(firstConsoleMessage)});
    if (url.length <= MAX_ISSUE_URL_LENGTH) return url;
  }
  for (let firstGitCommand = 0; ; firstGitCommand++) {
    const url = issueUrl(environment, {gitCommands: gitCommands.slice(firstGitCommand)});
    if (url.length <= MAX_ISSUE_URL_LENGTH || firstGitCommand >= gitCommands.length) return url;
  }
};
