/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

//! The binary as git's `GIT_SEQUENCE_EDITOR`: it waits for the app to rewrite an interactive rebase's todo list.
//!
//! Git runs it as `<editor> <todo file>`: the editor is the binary's name, found through the PATH the app hands git, and
//! `GITGUD_MODE` tells the binary to poll the todo file instead of starting the app. The process commands add this
//! environment to every git they run.

use std::collections::HashMap;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

const MODE_ENV: &str = "GITGUD_MODE";
const POLL_REBASE_TODO_MODE: &str = "poll-rebase-todo";

// The app rewrites the todo list within a second of git writing it: past this delay, it is gone or can't write
const WAIT_TIMEOUT: Duration = Duration::from_secs(60);
const POLL_INTERVAL: Duration = Duration::from_millis(300);

fn signal_path(todo: &Path, signal: &str) -> PathBuf {
    let mut path = todo.as_os_str().to_owned();
    path.push(format!(".{signal}"));
    PathBuf::from(path)
}

/// Waits for `<todo>.done` or `<todo>.abort`, the files the app writes once it rewrote the todo list or failed to.
/// On .done, deletes it and returns true: git runs the todo list. On .abort or after `timeout`, returns false: git cancels the rebase
pub fn poll_rebase_todo(todo: &Path, timeout: Duration, interval: Duration) -> bool {
    let done = signal_path(todo, "done");
    let abort = signal_path(todo, "abort");
    let deadline = Instant::now() + timeout;
    loop {
        if done.exists() {
            return std::fs::remove_file(&done).is_ok();
        }
        if abort.exists() || Instant::now() >= deadline {
            return false;
        }
        std::thread::sleep(interval);
    }
}

/// When git started the binary as its sequence editor, polls the todo file and returns the exit code; None otherwise
pub fn run_if_requested() -> Option<i32> {
    if std::env::var_os(MODE_ENV)? != POLL_REBASE_TODO_MODE {
        return None;
    }
    let ran = std::env::args_os().nth(1).is_some_and(|todo| poll_rebase_todo(Path::new(&todo), WAIT_TIMEOUT, POLL_INTERVAL));
    Some(if ran { 0 } else { 1 })
}

/// The environment that makes git run `exe` as its sequence editor: its name, found through `path` with `exe`'s folder first
fn editor_env(exe: &Path, path: OsString) -> HashMap<String, String> {
    let name = exe.file_name().unwrap_or_default().to_string_lossy().into_owned();
    let dirs = exe.parent().map(Path::to_path_buf).into_iter().chain(std::env::split_paths(&path));
    let path = std::env::join_paths(dirs).unwrap_or(path);
    HashMap::from([
        ("GIT_SEQUENCE_EDITOR".into(), name),
        (MODE_ENV.into(), POLL_REBASE_TODO_MODE.into()),
        ("PATH".into(), path.to_string_lossy().into_owned()),
    ])
}

/// The environment git runs with, computed on first use: the process' PATH is final by then
pub fn env() -> &'static HashMap<String, String> {
    static ENV: OnceLock<HashMap<String, String>> = OnceLock::new();
    ENV.get_or_init(|| match std::env::current_exe() {
        Ok(exe) => editor_env(&exe, std::env::var_os("PATH").unwrap_or_default()),
        Err(error) => {
            eprintln!("Can't find GitGud's executable, git will run the user's sequence editor: {error}");
            HashMap::new()
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SHORT: Duration = Duration::from_millis(10);

    fn todo_in_temp_dir(test: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("gitgud-sequence-editor-{test}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join("git-rebase-todo")
    }

    #[test]
    fn done_lets_git_run_the_todo_list_and_is_removed() {
        let todo = todo_in_temp_dir("done");
        let done = signal_path(&todo, "done");
        std::fs::write(&done, "").unwrap();
        assert!(poll_rebase_todo(&todo, Duration::from_secs(5), SHORT));
        assert!(!done.exists());
    }

    #[test]
    fn done_written_while_polling_is_seen() {
        let todo = todo_in_temp_dir("later");
        let done = signal_path(&todo, "done");
        let writer = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(50));
            std::fs::write(done, "").unwrap();
        });
        assert!(poll_rebase_todo(&todo, Duration::from_secs(5), SHORT));
        writer.join().unwrap();
    }

    #[test]
    fn abort_cancels_the_rebase() {
        let todo = todo_in_temp_dir("abort");
        std::fs::write(signal_path(&todo, "abort"), "").unwrap();
        assert!(!poll_rebase_todo(&todo, Duration::from_secs(5), SHORT));
    }

    #[test]
    fn no_signal_cancels_the_rebase_after_the_timeout() {
        let todo = todo_in_temp_dir("timeout");
        assert!(!poll_rebase_todo(&todo, Duration::from_millis(50), SHORT));
    }


    #[test]
    fn the_editor_is_a_bare_name_found_through_path() {
        let dir = std::env::temp_dir().join("bin");
        let env = editor_env(&dir.join("gitgud"), OsString::from("/usr/bin"));
        assert_eq!(env["GIT_SEQUENCE_EDITOR"], "gitgud");
        assert_eq!(std::env::split_paths(&env["PATH"]).collect::<Vec<_>>(), [dir, PathBuf::from("/usr/bin")]);
    }
}
