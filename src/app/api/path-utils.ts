// Pure JS path utilities — covers posix-style paths used on Linux/macOS,
// and Windows paths via the backslash normalisation below.

const SEP = '/';

function normalize(p: string) {
  // Normalise Windows backslashes
  return p.replace(/\\/g, SEP);
}

function resolve(...parts: string[]) {
  let resolved = '';
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = normalize(parts[i]);
    resolved = resolved ? `${p}/${resolved}` : p;
    if (p.startsWith(SEP) || /^[A-Za-z]:/.test(p)) break;
  }
  return resolved || SEP;
}

function dirname(p: string) {
  const norm = normalize(p);
  const idx = norm.lastIndexOf(SEP);
  if (idx <= 0) return idx === 0 ? SEP : '.';
  return norm.slice(0, idx);
}

export default {resolve, dirname};
