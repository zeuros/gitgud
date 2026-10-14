export const DEFAULT_EDITOR_COMMAND = 'code -g {file}:{line}';

// 'code -g "{file}:{line}"' => ['code', '-g', '/repo/a b.ts:12']. Placeholders are replaced after splitting, so paths with spaces stay one argument
export const editorCommandArgs = (command: string, file: string, line: number): string[] =>
  (command.match(/"[^"]*"|'[^']*'|\S+/g) ?? [])
    .map(arg => arg.replace(/^(["'])(.*)\1$/, '$2'))
    .map(arg => arg.replaceAll('{file}', file).replaceAll('{line}', `${line}`));
