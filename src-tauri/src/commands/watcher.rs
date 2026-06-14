use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, FileIdMap};
use tauri::{AppHandle, Emitter};

static WATCHERS: Mutex<Option<HashMap<String, Debouncer<RecommendedWatcher, FileIdMap>>>> =
    Mutex::new(None);

fn registry() -> std::sync::MutexGuard<
    'static,
    Option<HashMap<String, Debouncer<RecommendedWatcher, FileIdMap>>>,
> {
    WATCHERS.lock().unwrap()
}

/// Starts watching one or more paths; emits `watcher-event:{id}` on changes.
/// Mirrors the chokidar.watch() API surface from the Electron preload.
/// Events are debounced by 300 ms and coalesced per path via FileIdMap (inode-stable).
#[tauri::command]
pub fn watch_paths(
    app: AppHandle,
    id: String,
    paths: Vec<String>,
    recursive: Option<bool>,
    ignored_dirs: Option<Vec<String>>,
) -> Result<(), String> {
    let mode = if recursive.unwrap_or(true) {
        RecursiveMode::Recursive
    } else {
        RecursiveMode::NonRecursive
    };

    // Tauri event names allow only [a-zA-Z0-9\-/:\_ ] — replace everything else with '_'.
    let safe_id: String = id.chars()
        .map(|c| if c.is_alphanumeric() || matches!(c, '-' | '/' | ':' | '_') { c } else { '_' })
        .collect();
    let event_name = format!("watcher-event:{safe_id}");
    let app_clone = app.clone();

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

    let mut debouncer = new_debouncer(
        Duration::from_millis(600),
        None,
        move |res: DebounceEventResult| {
            let events = match res {
                Ok(evs) => evs,
                Err(_) => return,
            };

            // Flatten all debounced events, filter ignored dirs, deduplicate paths
            let mut seen = std::collections::HashSet::new();
            let mut filtered_paths: Vec<String> = Vec::new();
            for de in &events {
                for p in &de.event.paths {
                    if p.components().any(|c| {
                        let name = c.as_os_str().to_string_lossy();
                        skip.iter().any(|s| name == s.as_str())
                    }) {
                        continue;
                    }
                    if let Some(s) = p.to_str() {
                        if seen.insert(s.to_owned()) {
                            filtered_paths.push(s.to_owned());
                        }
                    }
                }
            }

            if filtered_paths.is_empty() {
                return;
            }

            let kind = format!("{:?}", events[0].event.kind).to_lowercase();
            let _ = app_clone.emit(&event_name, serde_json::json!({
                "kind": kind,
                "paths": filtered_paths,
            }));
        },
    )
    .map_err(|e| e.to_string())?;

    for p in &paths {
        debouncer
            .watcher()
            .watch(Path::new(p), mode)
            .map_err(|e| e.to_string())?;
        debouncer
            .cache()
            .add_root(Path::new(p), mode);
    }

    let mut guard = registry();
    guard.get_or_insert_with(HashMap::new).insert(id, debouncer);

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
