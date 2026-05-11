const EXT_TO_LANG: Record<string, string> = {
  // Web / JS ecosystem
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  mjs: 'javascript', cjs: 'javascript', cts: 'typescript', mts: 'typescript',
  html: 'html', css: 'css', scss: 'scss', sass: 'sass', less: 'less',
  vue: 'vue', svelte: 'svelte', astro: 'astro',
  mdx: 'mdx', graphql: 'graphql', gql: 'graphql',
  // Systems languages
  rs: 'rust', go: 'go',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
  cs: 'csharp', java: 'java', kt: 'kotlin', kts: 'kotlin',
  swift: 'swift', dart: 'dart', zig: 'zig',
  // JVM / functional
  scala: 'scala', clj: 'clojure', hs: 'haskell', ml: 'ocaml',
  fs: 'fsharp', ex: 'elixir', exs: 'elixir', erl: 'erlang',
  // Scripting
  py: 'python', rb: 'ruby', php: 'php', lua: 'lua', r: 'r',
  sh: 'shellscript', bash: 'shellscript', zsh: 'shellscript', fish: 'fish',
  ps1: 'powershell', groovy: 'groovy',
  // Data / config
  json: 'json', jsonc: 'jsonc', json5: 'json5',
  yaml: 'yaml', yml: 'yaml', toml: 'toml',
  xml: 'xml', csv: 'csv', tsv: 'tsv',
  ini: 'ini', env: 'dotenv',
  // Docs / markup
  md: 'markdown', tex: 'latex', rst: 'rst', adoc: 'asciidoc',
  // DB / query
  sql: 'sql', prisma: 'prisma',
  // Infrastructure
  tf: 'terraform', tfvars: 'terraform', hcl: 'hcl',
  // Other
  proto: 'proto', vim: 'viml', nim: 'nim',
  cr: 'crystal', ex2: 'elixir',
};

const BASENAME_TO_LANG: Record<string, string> = {
  dockerfile: 'docker',
  makefile: 'make',
  gemfile: 'ruby',
  rakefile: 'ruby',
  jenkinsfile: 'groovy',
  'cmakelists.txt': 'cmake',
  '.babelrc': 'json',
  '.eslintrc': 'json',
};

export function detectLang(path: string): string | undefined {
  const base = (path.split('/').pop() ?? '').toLowerCase();
  if (base.startsWith('.env')) return 'dotenv';
  if (BASENAME_TO_LANG[base]) return BASENAME_TO_LANG[base];
  const ext = base.includes('.') ? base.split('.').pop() : undefined;
  return ext ? EXT_TO_LANG[ext] : undefined;
}
