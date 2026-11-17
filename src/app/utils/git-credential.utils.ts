/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {errorMessage} from './error-message.utils';

export interface GitCredential {
  username: string;
  password: string;
}

/** Where git failed to authenticate: the server to sign in to, and the username git used, if any */
export interface AuthenticationFailure {
  /** `protocol://host`, as GitGud's credential helper matches it */
  serverUrl: string;
  username?: string;
  /** The server knew who was asking but refused (HTTP 403), e.g. a token that can't push used to push */
  forbidden?: true;
}

// Git's messages when it has no credential to send (no helper had one, and it may not prompt) or the server rejected it
const AUTHENTICATION_FAILURES = [
  /could not read (?:Username|Password) for '([^']+)'/,
  /Authentication failed for '([^']+)'/,
];
const FORBIDDEN = /unable to access '([^']+)': The requested URL returned error: 403/;

/** The authentication failure a git error reports, if it is one */
export const authenticationFailure = (error: unknown): AuthenticationFailure | undefined => {
  const message = errorMessage(error) ?? '';
  for (const pattern of [...AUTHENTICATION_FAILURES, FORBIDDEN]) {
    const failedUrl = pattern.exec(message)?.[1];
    if (!failedUrl || !URL.canParse(failedUrl)) continue;
    const {protocol, host, username} = new URL(failedUrl);
    return {
      serverUrl: `${protocol}//${host}`,
      ...(username ? {username: decodeURIComponent(username)} : {}),
      ...(pattern == FORBIDDEN ? {forbidden: true} : {}),
    };
  }
  return undefined;
};

/** Where to get a token for git over HTTPS on a host, and how to use SSH there instead */
export interface HostHelp {
  /** The host's page creating a token, or explaining how to; none for hosts GitGud doesn't know */
  tokenPageUrl?: string;
  sshGuideUrl: string;
}

export const hostHelp = (serverUrl: string): HostHelp => {
  switch (new URL(serverUrl).hostname) {
    case 'github.com':
      return {
        tokenPageUrl: 'https://github.com/settings/tokens/new?scopes=repo&description=GitGud',
        sshGuideUrl: 'https://docs.github.com/en/authentication/connecting-to-github-with-ssh',
      };
    case 'gitlab.com':
      return {
        tokenPageUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens?name=GitGud&scopes=read_repository,write_repository',
        sshGuideUrl: 'https://docs.gitlab.com/user/ssh/',
      };
    case 'bitbucket.org':
      return {
        tokenPageUrl: 'https://support.atlassian.com/bitbucket-cloud/docs/using-api-tokens/',
        sshGuideUrl: 'https://support.atlassian.com/bitbucket-cloud/docs/configure-ssh-and-two-step-verification/',
      };
    default:
      return {sshGuideUrl: 'https://git-scm.com/book/en/v2/Git-on-the-Server-Generating-Your-SSH-Public-Key'};
  }
};

/** The environment handing a credential to GitGud's credential helper, for the server it's for */
export const credentialEnv = (serverUrl: string, {username, password}: GitCredential): Record<string, string> => ({
  GITGUD_CREDENTIAL_URL: serverUrl,
  GITGUD_CREDENTIAL_USERNAME: username,
  GITGUD_CREDENTIAL_PASSWORD: password,
});
