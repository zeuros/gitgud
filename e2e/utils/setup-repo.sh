#!/usr/bin/env bash
# Creates two demo git repos used by the e2e video tests.
#   /tmp/gitgud-demo-base      — clean repo with branches + unstaged changes
#   /tmp/gitgud-demo-conflict  — same repo left in a merge conflict state

set -euo pipefail

BASE=/tmp/gitgud-demo-base
CONFLICT=/tmp/gitgud-demo-conflict

# ── helpers ───────────────────────────────────────────────────────────────────
g() { git -C "$BASE" "$@"; }
commit() { g add -A && g commit -m "$1"; }

# ── build base repo ───────────────────────────────────────────────────────────
rm -rf "$BASE" "$CONFLICT"
mkdir -p "$BASE"

g init -b main
g config user.name  "Demo Dev"
g config user.email "demo@gitgud.dev"

# ── 1: scaffold ───────────────────────────────────────────────────────────────
cat > "$BASE/README.md" << 'EOF'
# Todo App
A clean vanilla-JS todo app — no build step needed.
EOF
cat > "$BASE/.gitignore" << 'EOF'
node_modules/
.env
EOF
commit "feat: initialize project"

# ── 2: HTML ───────────────────────────────────────────────────────────────────
cat > "$BASE/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Todo App</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <h1>Todo App</h1>
    <div class="input-row">
      <input type="text" id="input" placeholder="What needs to be done?">
      <button id="add-btn">Add</button>
    </div>
    <ul id="list"></ul>
  </div>
  <script src="app.js"></script>
</body>
</html>
EOF
commit "feat: add HTML structure"

# ── 3: CSS ────────────────────────────────────────────────────────────────────
cat > "$BASE/styles.css" << 'EOF'
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f5f5f5;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.container {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  width: 480px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
}
h1 { font-size: 1.8rem; margin-bottom: 1.5rem; color: #1a1a2e; }
.input-row { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
input {
  flex: 1; padding: 0.75rem 1rem;
  border: 2px solid #e0e0e0; border-radius: 8px;
  font-size: 1rem; transition: border-color 0.2s;
}
input:focus { outline: none; border-color: #6c63ff; }
#add-btn {
  padding: 0.75rem 1.5rem; background: #6c63ff;
  color: white; border: none; border-radius: 8px;
  font-size: 1rem; cursor: pointer;
}
#add-btn:hover { background: #5a52d5; }
#list { list-style: none; }
.item {
  display: flex; align-items: center;
  padding: 0.75rem; border-radius: 8px;
}
.item:hover { background: #f8f8ff; }
.item span { flex: 1; }
.del { background: none; border: none; color: #ccc; cursor: pointer; font-size: 1.1rem; }
.del:hover { color: #ff4757; }
EOF
commit "feat: add base styles"

# ── 4: JS core ────────────────────────────────────────────────────────────────
cat > "$BASE/app.js" << 'EOF'
const input = document.getElementById('input');
const addBtn = document.getElementById('add-btn');
const list = document.getElementById('list');

let todos = [];

function addTodo() {
  const text = input.value.trim();
  if (!text) return;
  todos.push({ id: Date.now(), text, done: false });
  render(); input.value = '';
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  render();
}

function toggleTodo(id) {
  todos = todos.map(t => t.id === id ? { ...t, done: !t.done } : t);
  render();
}

function render() {
  list.innerHTML = todos.map(t => `
    <li class="item">
      <span style="text-decoration:${t.done ? 'line-through' : 'none'};cursor:pointer"
            onclick="toggleTodo(${t.id})">${t.text}</span>
      <button class="del" onclick="deleteTodo(${t.id})">✕</button>
    </li>
  `).join('');
}

addBtn.addEventListener('click', addTodo);
EOF
commit "feat: implement add, delete and toggle"

# ── 5: keyboard shortcuts ─────────────────────────────────────────────────────
cat >> "$BASE/app.js" << 'EOF'

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement === input) addTodo();
  if (e.key === 'Escape') { input.value = ''; input.blur(); }
});
EOF
commit "feat: add Enter/Escape keyboard shortcuts"

# ── 6: duplicate guard ────────────────────────────────────────────────────────
sed -i 's/if (!text) return;/if (!text || todos.some(t => t.text === text)) return;/' "$BASE/app.js"
commit "fix: prevent duplicate todo items"

# ── 7: v1.0.0 release ────────────────────────────────────────────────────────
cat > "$BASE/CHANGELOG.md" << 'EOF'
# Changelog
## v1.0.0 – 2026-01-10
- Add / delete / toggle todos
- Keyboard shortcuts
- Duplicate prevention
EOF
commit "chore: v1.0.0 release"
g tag v1.0.0

# ── feature/dark-mode branch (from v1.0.0) ───────────────────────────────────
g checkout -b feature/dark-mode

cat > "$BASE/styles.css" << 'EOF'
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #f5f5f5; --surface: white; --text: #1a1a2e;
  --accent: #6c63ff; --border: #e0e0e0;
}
[data-theme="dark"] {
  --bg: #0d0d1a; --surface: #1a1a2e; --text: #e8e8f0;
  --accent: #8b83ff; --border: #2d2d4a;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg); min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.3s;
}
.container {
  background: var(--surface); border-radius: 12px;
  padding: 2rem; width: 480px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08); transition: background 0.3s;
}
.header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
h1 { font-size: 1.8rem; color: var(--text); }
.theme-btn {
  background: none; border: 2px solid var(--border);
  border-radius: 6px; padding: 0.3rem 0.7rem; cursor: pointer; font-size: 1.1rem;
}
.input-row { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
input {
  flex: 1; padding: 0.75rem 1rem;
  border: 2px solid var(--border); border-radius: 8px;
  font-size: 1rem; background: var(--surface); color: var(--text);
}
input:focus { outline: none; border-color: var(--accent); }
#add-btn {
  padding: 0.75rem 1.5rem; background: var(--accent);
  color: white; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer;
}
#list { list-style: none; }
.item { display: flex; align-items: center; padding: 0.75rem; border-radius: 8px; color: var(--text); }
.item:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.item span { flex: 1; }
.del { background: none; border: none; color: #888; cursor: pointer; font-size: 1.1rem; }
.del:hover { color: #ff4757; }
EOF
commit "feat: dark mode CSS with custom properties"

cat >> "$BASE/app.js" << 'EOF'

function toggleTheme() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? '' : 'dark');
  document.querySelector('.theme-btn').textContent = dark ? '🌙' : '☀️';
  localStorage.setItem('theme', dark ? 'light' : 'dark');
}
if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.querySelector('.theme-btn').textContent = '☀️';
}
EOF
commit "feat: theme toggle with localStorage persistence"

# ── back to main — two more commits (also touch styles.css → conflict ─────────
g checkout main

# styles.css gets a footer comment on main too (sets up the conflict)
cat >> "$BASE/styles.css" << 'EOF'

/* Responsive breakpoint */
@media (max-width: 520px) { .container { width: 100%; border-radius: 0; } }
EOF
commit "feat: add responsive breakpoint"

cat > "$BASE/utils.js" << 'EOF'
const sanitize = t => t.replace(/[<>&"']/g, c =>
  ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' }[c]));
EOF
commit "refactor: extract sanitize helper"

cat > "$BASE/README.md" << 'EOF'
# Todo App

Vanilla-JS todo app — no build step.

## Features
- Add / delete / toggle todos
- Keyboard shortcuts (Enter / Escape)
- Duplicate prevention
- Dark mode with persistence

## Usage
Open `index.html` in any browser.
EOF
commit "docs: update README"

# ── experiment/local-storage branch (from main HEAD) ─────────────────────────
g checkout -b experiment/local-storage

cat > "$BASE/storage.js" << 'EOF'
const STORAGE_KEY = 'todos-v1';
const save = todos => localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } };
EOF
commit "experiment: add localStorage persistence module"

cat >> "$BASE/storage.js" << 'EOF'
const clear = () => localStorage.removeItem(STORAGE_KEY);
EOF
commit "experiment: add clear storage function"

# ── unstaged working-dir changes (for staging demo) ──────────────────────────
g checkout main
cat >> "$BASE/app.js" << 'EOF'

// WIP: filter bar
function filterTodos(view) {
  const shown = view === 'active' ? todos.filter(t => !t.done)
              : view === 'done'   ? todos.filter(t => t.done)
              : todos;
  // renderFiltered(shown);
}
EOF
echo "" >> "$BASE/styles.css"
echo "/* WIP: filter bar */" >> "$BASE/styles.css"
echo ".filter-bar { display: none; }" >> "$BASE/styles.css"

echo "✔ base repo created at $BASE"

# ── conflict repo — fresh repo branched at v1.0.0 to guarantee a conflict ─────
cp -r "$BASE" "$CONFLICT"
git -C "$CONFLICT" checkout -- .   # discard unstaged changes from the copy

# Both branches must edit the EXACT same line so git cannot auto-merge.
# We add a version comment at the top of styles.css — different text on each branch.

# Update main: bump the version header
git -C "$CONFLICT" checkout main
python3 - "$CONFLICT/styles.css" << 'PYEOF'
import sys
p = sys.argv[1]
lines = open(p).readlines()
# Insert a versioned comment as first line
lines.insert(0, '/* Todo App — stable build v1.1 */\n')
open(p, 'w').writelines(lines)
PYEOF
git -C "$CONFLICT" add styles.css
git -C "$CONFLICT" commit -m "chore: mark stable build v1.1 in styles header"

# Update feature/dark-mode: different version comment on same line position
git -C "$CONFLICT" checkout feature/dark-mode
python3 - "$CONFLICT/styles.css" << 'PYEOF'
import sys
p = sys.argv[1]
lines = open(p).readlines()
lines.insert(0, '/* Todo App — dark-mode edition v2.0 */\n')
open(p, 'w').writelines(lines)
PYEOF
git -C "$CONFLICT" add styles.css
git -C "$CONFLICT" commit -m "chore: mark dark-mode edition in styles header"

# Merge feature/dark-mode into main → line 1 conflicts
git -C "$CONFLICT" checkout main
git -C "$CONFLICT" merge feature/dark-mode --no-edit 2>/dev/null || true
# Verify conflict state
if git -C "$CONFLICT" diff --name-only --diff-filter=U | grep -q "styles.css"; then
  echo "✔ conflict repo created at $CONFLICT (conflict in styles.css)"
else
  echo "⚠ merge auto-resolved — injecting conflict markers manually"
  python3 - "$CONFLICT/styles.css" << 'PYEOF'
import sys, re
p = sys.argv[1]
content = open(p).read()
# Replace the first comment line with conflict markers
first_line_end = content.index('\n') + 1
header = content[:first_line_end].strip()
rest   = content[first_line_end:]
conflict = f"<<<<<<< HEAD\n{header}\n=======\n/* Todo App — dark-mode edition v2.0 */\n>>>>>>> feature/dark-mode\n"
open(p, 'w').write(conflict + rest)
PYEOF
  # Write git merge state files so the app shows conflicted status
  git -C "$CONFLICT" checkout -- styles.css 2>/dev/null || true
  python3 - "$CONFLICT/styles.css" << 'PYEOF'
import sys
p = sys.argv[1]
lines = open(p).readlines()
lines.insert(0, '<<<<<<< HEAD\n/* Todo App — stable build v1.1 */\n=======\n/* Todo App — dark-mode edition v2.0 */\n>>>>>>> feature/dark-mode\n')
open(p, 'w').writelines(lines)
PYEOF
  git -C "$CONFLICT" update-index --assume-unchanged styles.css 2>/dev/null || true
  MERGE_HASH=$(git -C "$CONFLICT" rev-parse feature/dark-mode)
  echo "$MERGE_HASH" > "$CONFLICT/.git/MERGE_HEAD"
  echo "Merge feature/dark-mode into main" > "$CONFLICT/.git/MERGE_MSG"
  echo "✔ conflict repo created at $CONFLICT (manually injected)"
fi
echo "Done"
