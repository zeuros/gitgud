import {describe, expect, it} from 'vitest';
import {errorMessage} from './error-message.utils';

describe('errorMessage', () => {
  it('reads an Error', () => expect(errorMessage(new Error('boom'))).toBe('boom'));

  it('strips the exit status of a git error', () =>
    expect(errorMessage('exited 128\nfatal: not a git repository\n')).toBe('fatal: not a git repository'));

  it('reads the message of a Rust error struct', () =>
    expect(errorMessage({kind: 'watch-limit', message: 'too many watches', watchLimit: 8192})).toBe('too many watches'));

  it('has nothing to say about other values', () => {
    expect(errorMessage({kind: 'other'})).toBeUndefined();
    expect(errorMessage(undefined)).toBeUndefined();
  });
});
