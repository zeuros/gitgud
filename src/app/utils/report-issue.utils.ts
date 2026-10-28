export interface EnvironmentInfo {
  appVersion: string;
  buildCommit?: string;
  packageFormat?: string;
  platform: string;
  arch: string;
}

// New GitHub issue with a template body and the app's environment filled in
export const reportIssueUrl = ({appVersion, buildCommit, packageFormat, platform, arch}: EnvironmentInfo) => {
  const version = appVersion + (buildCommit ? ` (${buildCommit})` : '');
  const body = [
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
    `- GitGud: ${version}`,
    `- OS: ${platform} ${arch}`,
    ...(packageFormat ? [`- Package: ${packageFormat}`] : []),
  ].join('\n');
  return `https://github.com/zeuros/gitgud/issues/new?body=${encodeURIComponent(body)}`;
};
