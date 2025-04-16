
// System dependant separator
export const SEPARATOR: '\\' | '/' = (window as any).require('path').sep;


export const DATE_FORMAT = 'd/M/YYYY @ HH:mm';
export const PREFIXES: ReadonlyArray<string> = ['refs/heads', 'refs/remotes']
export const MINUTE_MS = 60 * 1000;
export const DEFAULT_AUTO_FETCH_INTERVAL = 5 * MINUTE_MS;