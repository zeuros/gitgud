// Pure JS path utilities — covers posix-style paths used on Linux/macOS,
// and Windows paths via the backslash normalisation below.

const SEP = '/';

function normalize(p: string): string {
  // Normalise Windows backslashes
  return p.replace(/\\/g, SEP);
}

function resolve(...parts: string[]): string {
  let resolved = '';
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = normalize(parts[i]);
    resolved = resolved ? `${p}/${resolved}` : p;
    if (p.startsWith(SEP) || /^[A-Za-z]:/.test(p)) break;
  }
  return resolved || SEP;
}

function dirname(p: string): string {
  const norm = normalize(p);
  const idx = norm.lastIndexOf(SEP);
  if (idx <= 0) return idx === 0 ? SEP : '.';
  return norm.slice(0, idx);
}

function extname(p: string): string {
  const base = normalize(p).split(SEP).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot) : '';
}

export default {resolve, dirname, extname};
