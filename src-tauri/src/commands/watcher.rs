use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use notify::event::{EventKind, ModifyKind};
use ignore::gitignore::{Gitignore, GitignoreBuilder};
use ignore::WalkBuilder;
use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

/// Emit once no new event arrived for this long…
const QUIET: Duration = Duration::from_millis(600);
/// …or at the latest this long after the first pending event (continuous writes).
const MAX_WAIT: Duration = Duration::from_millis(2000);
const TICK: Duration = Duration::from_millis(100);

/// A running watcher. Dropping it stops the flush thread and the OS watcher.
struct WatchHandle {
    _watcher: Arc<Mutex<RecommendedWatcher>>,
    stop: Arc<AtomicBool>,
}

impl Drop for WatchHandle {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
    }
}

static WATCHERS: Mutex<Option<HashMap<String, WatchHandle>>> = Mutex::new(None);

fn registry() -> std::sync::MutexGuard<'static, Option<HashMap<String, WatchHandle>>> {
    WATCHERS.lock().unwrap()
}

#[derive(Default)]
struct Pending {
    paths: Vec<String>,
    seen: HashSet<String>,
    kind: Option<String>,
    first: Option<Instant>,
    last: Option<Instant>,
    /// Directories created/moved in after startup, still to be watched (Linux per-dir mode).
    new_dirs: Vec<PathBuf>,
}

/// The ignore rules of a worktree, read when the watch starts: its .gitignore files (the deepest first),
/// then the repository's info/exclude and the global excludes file
struct GitIgnoreRules {
    /// Each matcher with its directory, relative to the worktree
    matchers: Vec<(PathBuf, Gitignore)>,
}

impl GitIgnoreRules {
    /// `dirs`: the worktree's directories, whose .gitignore files are read
    fn read(worktree: &Path, dirs: &[PathBuf]) -> Self {
        let mut matchers: Vec<(PathBuf, Gitignore)> = std::iter::once(worktree)
            .chain(dirs.iter().map(PathBuf::as_path))
            .filter_map(|dir| Some((dir.strip_prefix(worktree).ok()?.to_path_buf(), Gitignore::new(dir.join(".gitignore")).0)))
            .chain(common_dir(worktree).map(|dir| (PathBuf::new(), Gitignore::new(dir.join("info/exclude")).0)))
            .chain(std::iter::once((PathBuf::new(), GitignoreBuilder::new(worktree).build_global().0)))
            .filter(|(_, matcher)| !matcher.is_empty())
            .collect();
        // Stable: at the worktree's root, .gitignore comes before info/exclude and the global file
        matchers.sort_by_key(|(dir, _)| std::cmp::Reverse(dir.components().count()));
        GitIgnoreRules { matchers }
    }

    /// `relative`: a path relative to the worktree. The first rule matching it or a parent decides, a `!pattern` keeping it
    fn is_ignored(&self, relative: &Path, is_dir: bool) -> bool {
        self.matchers.iter()
            .filter_map(|(dir, matcher)| Some(matcher.matched_path_or_any_parents(relative.strip_prefix(dir).ok()?, is_dir)))
            .find(|matched| !matched.is_none())
            .is_some_and(|matched| matched.is_ignore())
    }
}

/// The common dir of the repository `worktree` belongs to: its `.git` dir, or for a linked worktree (`.git` file
/// holding `gitdir: <main>/.git/worktrees/<name>`) the dir its `commondir` file names
fn common_dir(worktree: &Path) -> Option<PathBuf> {
    let dot_git = worktree.join(".git");
    if dot_git.is_dir() {
        return Some(dot_git);
    }
    let git_dir = worktree.join(std::fs::read_to_string(&dot_git).ok()?.trim().strip_prefix("gitdir: ")?);
    let common_dir = std::fs::read_to_string(git_dir.join("commondir")).ok()?;
    Some(git_dir.join(common_dir.trim()))
}

/// A watched root, and the ignore rules of the worktree it is when the watch respects them
struct Root {
    path: PathBuf,
    git_ignore_rules: Option<Arc<GitIgnoreRules>>,
}

/// Whether `path` is in an ignored dir below the watched root it belongs to (a root may itself be in
/// one: a git dir, a repository under /tmp), or excluded by the root's ignore rules
fn is_ignored(path: &Path, is_dir: bool, roots: &[Root], skip: &[String]) -> bool {
    let (relative, git_ignore_rules) = roots.iter()
        .find_map(|root| Some((path.strip_prefix(&root.path).ok()?, root.git_ignore_rules.as_deref())))
        .unwrap_or((path, None));
    relative.components().any(|c| {
        let name = c.as_os_str().to_string_lossy();
        skip.iter().any(|s| name == s.as_str())
    }) || git_ignore_rules.is_some_and(|rules| rules.is_ignored(relative, is_dir))
}

/// The directories below `dir`, never descending into ignored dirs (`skip` names, and with `git_ignore` what the
/// repository's ignore rules exclude) or symlinks. A directory that can't be read is skipped.
fn tree_dirs(dir: &Path, skip: &[String], git_ignore: bool) -> Vec<PathBuf> {
    let skip = skip.to_vec();
    WalkBuilder::new(dir)
        .standard_filters(false)
        .git_ignore(git_ignore)
        .git_exclude(git_ignore)
        .git_global(git_ignore)
        .parents(git_ignore)
        .filter_entry(move |entry| {
            let name = entry.file_name().to_string_lossy();
            // DirEntry::file_type doesn't follow symlinks
            entry.file_type().is_some_and(|t| t.is_dir()) && !skip.iter().any(|s| name == s.as_str())
        })
        .build()
        .flatten()
        .filter(|entry| entry.depth() > 0)
        .map(|entry| entry.into_path())
        .collect()
}

/// Adds a non-recursive watch on `dir` and its subdirectories `dirs` (from `tree_dirs`). Recursive inotify
/// watching would register a watch for every directory of node_modules/target/.venv… only to drop their events afterwards.
/// Fails if `dir` itself can't be watched or the inotify watch limit is hit; a subdirectory
/// that vanished meanwhile is skipped.
#[cfg(target_os = "linux")]
fn watch_tree(watcher: &Mutex<RecommendedWatcher>, dir: &Path, dirs: &[PathBuf]) -> notify::Result<()> {
    let mut watcher = watcher.lock().unwrap();
    watcher.watch(dir, RecursiveMode::NonRecursive)?;
    for subdir in dirs {
        if let Err(error) = watcher.watch(subdir, RecursiveMode::NonRecursive) {
            if matches!(error.kind, notify::ErrorKind::MaxFilesWatch) {
                return Err(error);
            }
        }
    }
    Ok(())
}

/// Starts watching one or more paths; emits `watcher-event:{id}` on changes.
/// Backs `window.tauri.chokidar.watch()` in the bridge.
/// Events are debounced (QUIET / MAX_WAIT) and deduplicated per path.
#[tauri::command]
pub fn watch_paths(
    app: AppHandle,
    id: String,
    paths: Vec<String>,
    recursive: Option<bool>,
    ignored_dirs: Vec<String>,
    respect_git_ignore: Option<bool>,
) -> Result<(), String> {
    let recursive = recursive.unwrap_or(true);
    let git_ignore = recursive && respect_git_ignore.unwrap_or(false);

    // Tauri event names allow only [a-zA-Z0-9\-/:\_ ] — replace everything else with '_'.
    let safe_id: String = id.chars()
        .map(|c| if c.is_alphanumeric() || matches!(c, '-' | '/' | ':' | '_') { c } else { '_' })
        .collect();
    let event_name = format!("watcher-event:{safe_id}");

    let skip = Arc::new(ignored_dirs);
    // The directories of each recursive root: watched one by one on Linux, their .gitignore files read with git_ignore
    let root_dirs: Vec<Vec<PathBuf>> = paths.iter()
        .map(|p| if recursive && (git_ignore || cfg!(target_os = "linux")) { tree_dirs(Path::new(p), &skip, git_ignore) } else { vec![] })
        .collect();
    // The canonical roots too: FSEvents (macOS) reports resolved paths, /private/tmp/… for a root opened as /tmp/…
    let roots: Arc<Vec<Root>> = Arc::new(paths.iter().map(PathBuf::from).zip(&root_dirs)
        .flat_map(|(root, dirs)| {
            let git_ignore_rules = git_ignore.then(|| Arc::new(GitIgnoreRules::read(&root, dirs)));
            let canonical = root.canonicalize().ok().filter(|canonical| *canonical != root)
                .map(|path| Root { path, git_ignore_rules: git_ignore_rules.clone() });
            std::iter::once(Root { path: root, git_ignore_rules }).chain(canonical)
        })
        .collect());

    let pending = Arc::new(Mutex::new(Pending::default()));
    let stop = Arc::new(AtomicBool::new(false));

    // Runs on notify's event thread: only record, never call back into the watcher (deadlock).
    let handler = {
        let pending = pending.clone();
        let skip = skip.clone();
        let roots = roots.clone();
        move |res: notify::Result<Event>| {
            let Ok(event) = res else { return };
            if matches!(event.kind, EventKind::Access(_)) {
                return;
            }
            let adds_dir = recursive
                && cfg!(target_os = "linux")
                && matches!(event.kind, EventKind::Create(_) | EventKind::Modify(ModifyKind::Name(_)));

            let mut p = pending.lock().unwrap();
            for path in &event.paths {
                // symlink_metadata: a symlink to a directory must not be walked
                let is_dir = path.symlink_metadata().is_ok_and(|m| m.is_dir());
                if is_ignored(path, is_dir, &roots, &skip) {
                    continue;
                }
                if adds_dir && is_dir {
                    p.new_dirs.push(path.clone());
                }
                if let Some(s) = path.to_str() {
                    // git reports paths with `/`; on Windows notify joins the watched root and the file name with `\`
                    let s = if cfg!(windows) { s.replace('\\', "/") } else { s.to_owned() };
                    if p.seen.insert(s.clone()) {
                        p.paths.push(s);
                    }
                }
            }
            if !p.paths.is_empty() {
                let now = Instant::now();
                p.first.get_or_insert(now);
                p.last = Some(now);
                p.kind.get_or_insert_with(|| format!("{:?}", event.kind).to_lowercase());
            }
        }
    };

    let watcher = Arc::new(Mutex::new(
        notify::recommended_watcher(handler).map_err(|e| e.to_string())?,
    ));

    for (path, dirs) in paths.iter().zip(&root_dirs) {
        #[cfg(target_os = "linux")]
        if recursive {
            watch_tree(&watcher, Path::new(path), dirs).map_err(|e| e.to_string())?;
            continue;
        }
        let _ = dirs;
        let mode = if recursive { RecursiveMode::Recursive } else { RecursiveMode::NonRecursive };
        watcher.lock().unwrap().watch(Path::new(path), mode).map_err(|e| e.to_string())?;
    }

    // Flush thread: watches newly created dirs and emits debounced batches.
    {
        let watcher = watcher.clone();
        let stop = stop.clone();
        std::thread::spawn(move || {
            while !stop.load(Ordering::Relaxed) {
                std::thread::sleep(TICK);

                let (new_dirs, batch) = {
                    let mut p = pending.lock().unwrap();
                    let new_dirs = std::mem::take(&mut p.new_dirs);
                    let now = Instant::now();
                    let due = match (p.first, p.last) {
                        (Some(first), Some(last)) => now - last >= QUIET || now - first >= MAX_WAIT,
                        _ => false,
                    };
                    let batch = due.then(|| {
                        let batch = (p.kind.take().unwrap_or_default(), std::mem::take(&mut p.paths));
                        *p = Pending::default();
                        batch
                    });
                    (new_dirs, batch)
                };

                #[cfg(target_os = "linux")]
                for new_dir in &new_dirs {
                    // The dir may already be gone again; nobody to report to from here.
                    let _ = watch_tree(&watcher, new_dir, &tree_dirs(new_dir, &skip, git_ignore));
                }
                #[cfg(not(target_os = "linux"))]
                let _ = (&new_dirs, &watcher);

                if let Some((kind, paths)) = batch {
                    let _ = app.emit(&event_name, serde_json::json!({
                        "kind": kind,
                        "paths": paths,
                    }));
                }
            }
        });
    }

    let mut guard = registry();
    guard.get_or_insert_with(HashMap::new).insert(id, WatchHandle { _watcher: watcher, stop });

    Ok(())
}

/// Stops and removes a watcher by ID.
#[tauri::command]
pub fn close_watcher(id: String) {
    let mut guard = registry();
    if let Some(map) = guard.as_mut() {
        map.remove(&id);
    }
}

/// Drops all active watchers — called on webview init to kill stale watchers
/// from a previous JS session (e.g. after Ctrl+R reload).
#[tauri::command]
pub fn close_all_watchers() {
    let mut guard = registry();
    if let Some(map) = guard.as_mut() {
        map.clear();
    }
}

#[cfg(test)]
mod tests;
