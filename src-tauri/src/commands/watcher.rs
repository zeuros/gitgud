use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use notify::event::{EventKind, ModifyKind};
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

fn is_ignored(p: &Path, skip: &[String]) -> bool {
    p.components().any(|c| {
        let name = c.as_os_str().to_string_lossy();
        skip.iter().any(|s| name == s.as_str())
    })
}

/// Adds a non-recursive watch on `dir` and every subdirectory, never descending into ignored
/// dirs or symlinks. Recursive inotify watching would register a watch for every directory of
/// node_modules/target/… only to drop their events afterwards.
/// Fails if `dir` itself can't be watched or the inotify watch limit is hit; a subdirectory
/// that vanished mid-walk is skipped.
#[cfg(target_os = "linux")]
fn watch_tree(watcher: &Mutex<RecommendedWatcher>, dir: &Path, skip: &[String]) -> notify::Result<()> {
    let mut stack = vec![dir.to_path_buf()];
    let mut watcher = watcher.lock().unwrap();
    while let Some(d) = stack.pop() {
        if let Err(e) = watcher.watch(&d, RecursiveMode::NonRecursive) {
            if d == dir || matches!(e.kind, notify::ErrorKind::MaxFilesWatch) {
                return Err(e);
            }
            continue;
        }
        let Ok(entries) = std::fs::read_dir(&d) else { continue };
        for e in entries.flatten() {
            // DirEntry::file_type doesn't follow symlinks
            if !e.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                continue;
            }
            let name = e.file_name();
            let name = name.to_string_lossy();
            if skip.iter().any(|s| name == s.as_str()) {
                continue;
            }
            stack.push(e.path());
        }
    }
    Ok(())
}

/// Starts watching one or more paths; emits `watcher-event:{id}` on changes.
/// Mirrors the chokidar.watch() API surface from the Electron preload.
/// Events are debounced (QUIET / MAX_WAIT) and deduplicated per path.
#[tauri::command]
pub fn watch_paths(
    app: AppHandle,
    id: String,
    paths: Vec<String>,
    recursive: Option<bool>,
    ignored_dirs: Option<Vec<String>>,
) -> Result<(), String> {
    let recursive = recursive.unwrap_or(true);

    // Tauri event names allow only [a-zA-Z0-9\-/:\_ ] — replace everything else with '_'.
    let safe_id: String = id.chars()
        .map(|c| if c.is_alphanumeric() || matches!(c, '-' | '/' | ':' | '_') { c } else { '_' })
        .collect();
    let event_name = format!("watcher-event:{safe_id}");

    let mut skip: Vec<String> = vec![
        ".git".into(), "node_modules".into(), "dist".into(),
        "build".into(), "cache".into(), "tmp".into(),
        "target".into(), ".angular".into(),
    ];
    if let Some(extra) = ignored_dirs {
        for dir in extra {
            if !skip.contains(&dir) {
                skip.push(dir);
            }
        }
    }
    let skip = Arc::new(skip);

    let pending = Arc::new(Mutex::new(Pending::default()));
    let stop = Arc::new(AtomicBool::new(false));

    // Runs on notify's event thread: only record, never call back into the watcher (deadlock).
    let handler = {
        let pending = pending.clone();
        let skip = skip.clone();
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
                if is_ignored(path, &skip) {
                    continue;
                }
                // symlink_metadata: a symlink to a directory must not be walked
                if adds_dir && path.symlink_metadata().is_ok_and(|m| m.is_dir()) {
                    p.new_dirs.push(path.clone());
                }
                if let Some(s) = path.to_str() {
                    if p.seen.insert(s.to_owned()) {
                        p.paths.push(s.to_owned());
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

    for p in &paths {
        #[cfg(target_os = "linux")]
        if recursive {
            watch_tree(&watcher, Path::new(p), &skip).map_err(|e| e.to_string())?;
            continue;
        }
        let mode = if recursive { RecursiveMode::Recursive } else { RecursiveMode::NonRecursive };
        watcher.lock().unwrap().watch(Path::new(p), mode).map_err(|e| e.to_string())?;
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
                for d in &new_dirs {
                    // The dir may already be gone again; nobody to report to from here.
                    let _ = watch_tree(&watcher, d, &skip);
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
