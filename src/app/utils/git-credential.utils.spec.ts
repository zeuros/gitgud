import {describe, expect, it} from 'vitest';
import {authenticationFailure, credentialEnv} from './git-credential.utils';

describe('authenticationFailure', () => {
  it('reads the server git had no credential for', () => {
    expect(authenticationFailure("exited 128\nfatal: could not read Username for 'https://github.com': terminal prompts disabled"))
      .toEqual({serverUrl: 'https://github.com'});
    expect(authenticationFailure(new Error("fatal: could not read Username for 'https://github.com': No such device or address")))
      .toEqual({serverUrl: 'https://github.com'});
  });

  it('keeps the username git asked a password for', () => {
    expect(authenticationFailure("fatal: could not read Password for 'https://ada%40example.com@gitlab.example.com:8443': terminal prompts disabled"))
      .toEqual({serverUrl: 'https://gitlab.example.com:8443', username: 'ada@example.com'});
  });

  it('reads the server that rejected the credential', () => {
    expect(authenticationFailure("remote: Invalid username or token.\nfatal: Authentication failed for 'https://github.com/ada/private.git/'"))
      .toEqual({serverUrl: 'https://github.com'});
  });

  it('ignores other errors', () => {
    expect(authenticationFailure("fatal: unable to access 'https://github.com/ada/repo.git/': Could not resolve host: github.com")).toBeUndefined();
    expect(authenticationFailure('git@github.com: Permission denied (publickey).')).toBeUndefined();
    expect(authenticationFailure(undefined)).toBeUndefined();
  });
});

describe('credentialEnv', () => {
  it('names the server the credential is for', () => {
    expect(credentialEnv('https://github.com', {username: 'ada', password: 'token'})).toEqual({
      GITGUD_CREDENTIAL_URL: 'https://github.com',
      GITGUD_CREDENTIAL_USERNAME: 'ada',
      GITGUD_CREDENTIAL_PASSWORD: 'token',
    });
  });
});
