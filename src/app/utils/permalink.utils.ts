// 'git@github.com:user/repo.git', 'ssh://git@host:22/user/repo', 'https://token@host/user/repo.git' => 'https://host/user/repo'
export const remoteWebUrl = (remoteUrl: string): string | undefined => {
  const url = remoteUrl.trim().replace(/\.git\/?$/, '').replace(/\/$/, '');
  const scp = url.match(/^(?:[^@/]+@)?([^:/]+):(?!\/\/)(.+)$/); // user@host:path
  if (scp) return `https://${scp[1]}/${scp[2]}`;
  const standard = url.match(/^(?:https?|ssh|git):\/\/(?:[^@/]+@)?([^:/]+)(?::\d+)?\/(.+)$/);
  return standard ? `https://${standard[1]}/${standard[2]}` : undefined;
};

// Link to lines of a file at a commit, in the format of the host
export const permalink = (webUrl: string, sha: string, path: string, start: number, end: number) => {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const single = start === end;
  if (/gitlab/.test(webUrl)) return `${webUrl}/-/blob/${sha}/${encodedPath}#L${start}${single ? '' : `-${end}`}`;
  if (/bitbucket/.test(webUrl)) return `${webUrl}/src/${sha}/${encodedPath}#lines-${start}${single ? '' : `:${end}`}`;
  return `${webUrl}/blob/${sha}/${encodedPath}#L${start}${single ? '' : `-L${end}`}`;
};
