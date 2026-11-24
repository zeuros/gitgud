import {describe, expect, it} from 'vitest';
import {appendTranscriptChunk, claudeProjectDirName, EMPTY_TRANSCRIPT} from './claude-transcript-utils';

describe('claudeProjectDirName', () => {
  it('replaces each non-alphanumeric character with a dash', () =>
    expect(claudeProjectDirName('/home/me/.config/my_repo')).toBe('-home-me--config-my-repo'));
});

describe('appendTranscriptChunk', () => {
  const first = appendTranscriptChunk(EMPTY_TRANSCRIPT, {
    title: 'Fix the build',
    nextByte: 100,
    restarted: false,
    entries: [{kind: 'prompt', text: 'fix the build'}, {kind: 'tool', id: 't1', name: 'Bash', summary: 'npm test'}],
  });

  it('puts a result coming in a later chunk on its tool, keeping the title', () =>
    expect(appendTranscriptChunk(first, {
      title: null,
      nextByte: 150,
      restarted: false,
      entries: [{kind: 'result', toolId: 't1', result: '1 failing', isError: true}, {kind: 'text', text: 'Fixed.'}],
    })).toEqual({
      title: 'Fix the build',
      nextByte: 150,
      entries: [
        {kind: 'prompt', text: 'fix the build'},
        {kind: 'tool', id: 't1', name: 'Bash', summary: 'npm test', result: '1 failing', isError: true},
        {kind: 'text', text: 'Fixed.'},
      ],
    }));

  it('starts over when the file was rewritten', () =>
    expect(appendTranscriptChunk(first, {title: null, nextByte: 20, restarted: true, entries: [{kind: 'prompt', text: 'new'}]}))
      .toEqual({title: undefined, nextByte: 20, entries: [{kind: 'prompt', text: 'new'}]}));
});
