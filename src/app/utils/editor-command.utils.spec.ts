import {describe, expect, it} from 'vitest';
import {DEFAULT_EDITOR_COMMAND, editorCommandArgs} from './editor-command.utils';

describe('editor command', () => {
  it('fills the placeholders, keeping paths with spaces in one argument', () => {
    expect(editorCommandArgs(DEFAULT_EDITOR_COMMAND, '/repo/my file.ts', 12)).toEqual(['code', '-g', '/repo/my file.ts:12']);
    expect(editorCommandArgs('idea --line {line} {file}', '/a.ts', 3)).toEqual(['idea', '--line', '3', '/a.ts']);
    expect(editorCommandArgs('"/opt/My Editor/bin/edit" "+{line}" {file}', '/a.ts', 3)).toEqual(['/opt/My Editor/bin/edit', '+3', '/a.ts']);
  });
});
