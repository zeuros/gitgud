
// System dependant separator
export const SEPARATOR: '\\' | '/' = (window as any).require('path').sep;


export const PREFIXES: ReadonlyArray<string> = ['refs/heads', 'refs/remotes']