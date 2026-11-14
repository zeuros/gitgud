/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

//! The binary as git's `GIT_SEQUENCE_EDITOR`: it copies an interactive rebase's sequence for the app, or puts the app's in place.
//!
//! The app names the binary (`GITGUD_BINARY_NAME`) as the sequence editor of `git rebase -i`, git finding it through
//! PATH. Git runs it as `<name> <todo file>` and leaves `GIT_SEQUENCE_EDITOR` in its environment: seeing its own name
//! there, the binary does what the app's environment asks instead of starting the app:
//! - `GITGUD_COPY_REBASE_TODO_TO`: copies git's sequence to that file and exits 1, git cancelling the rebase
//! - `GITGUD_MOVE_REBASE_TODO_FROM`: moves that file over git's sequence and exits 0, git running it

use std::ffi::OsStr;
use std::path::{Path, PathBuf};

const REBASE_TODO_FILE_NAME: &str = "git-rebase-todo";
const COPY_REBASE_TODO_TO: &str = "GITGUD_COPY_REBASE_TODO_TO";
const MOVE_REBASE_TODO_FROM: &str = "GITGUD_MOVE_REBASE_TODO_FROM";

// The sequence editor's exit codes: git runs the sequence, or cancels the rebase and removes its state
const RUN_REBASE: i32 = 0;
const CANCEL_REBASE: i32 = 1;

/// Sets `GITGUD_BINARY_NAME` and makes it name this binary in PATH, for the git the app runs. An installed binary
/// already comes first there (`/usr/bin/gitgud`), and PATH is left as is; otherwise (a dev build, an AppImage, a
/// Windows install folder) its folder goes first, holding no other tool to take precedence over
pub fn expose_binary_name() {
    let Ok(exe) = std::env::current_exe() else { return };
    let (Some(dir), Some(name)) = (exe.parent(), exe.file_name()) else { return };
    std::env::set_var("GITGUD_BINARY_NAME", name);
    let path = std::env::var_os("PATH").unwrap_or_default();
    let first_in_path = std::env::split_paths(&path).map(|dir| dir.join(name)).find(|candidate| candidate.is_file());
    if first_in_path.and_then(|found| found.canonicalize().ok()) == exe.canonicalize().ok() {
        return;
    }
    if let Ok(path) = std::env::join_paths(std::iter::once(dir.to_path_buf()).chain(std::env::split_paths(&path))) {
        std::env::set_var("PATH", path);
    }
}

/// Moves `move_from` over the todo file, letting git run it, or copies the todo file to `copy_to`, cancelling the
/// rebase. Without either, or when the file operation fails, cancels it
fn edit_rebase_todo(todo: &Path, copy_to: Option<&Path>, move_from: Option<&Path>) -> i32 {
    let result = match (copy_to, move_from) {
        (_, Some(move_from)) => std::fs::rename(move_from, todo).map(|()| RUN_REBASE),
        (Some(copy_to), None) => std::fs::copy(todo, copy_to).map(|_| CANCEL_REBASE),
        (None, None) => Ok(CANCEL_REBASE),
    };
    result.unwrap_or_else(|error| {
        eprintln!("GitGud's sequence editor: {error}");
        CANCEL_REBASE
    })
}

/// When git started the binary as its sequence editor, edits the todo file and returns the exit code; None otherwise
pub fn run_if_requested() -> Option<i32> {
    let sequence_editor = std::env::var_os("GIT_SEQUENCE_EDITOR")?;
    let todo = PathBuf::from(std::env::args_os().nth(1)?);
    let exe = std::env::current_exe().ok()?;
    if exe.file_name() != Some(sequence_editor.as_os_str()) || todo.file_name() != Some(OsStr::new(REBASE_TODO_FILE_NAME)) {
        return None;
    }
    let copy_to = std::env::var_os(COPY_REBASE_TODO_TO).map(PathBuf::from);
    let move_from = std::env::var_os(MOVE_REBASE_TODO_FROM).map(PathBuf::from);
    Some(edit_rebase_todo(&todo, copy_to.as_deref(), move_from.as_deref()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(test: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("gitgud-sequence-editor-{test}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn copy_to_hands_git_sequence_to_the_app_and_cancels_the_rebase() {
        let dir = temp_dir("copy");
        let (todo, copy) = (dir.join(REBASE_TODO_FILE_NAME), dir.join("copy"));
        std::fs::write(&todo, "pick 1234567 subject\n").unwrap();
        assert_eq!(edit_rebase_todo(&todo, Some(&copy), None), CANCEL_REBASE);
        assert_eq!(std::fs::read_to_string(&copy).unwrap(), "pick 1234567 subject\n");
    }

    #[test]
    fn move_from_replaces_git_sequence_and_runs_the_rebase() {
        let dir = temp_dir("move");
        let (todo, sequence) = (dir.join(REBASE_TODO_FILE_NAME), dir.join("sequence"));
        std::fs::write(&todo, "pick 1234567 subject\n").unwrap();
        std::fs::write(&sequence, "drop 1234567 subject\n").unwrap();
        assert_eq!(edit_rebase_todo(&todo, None, Some(&sequence)), RUN_REBASE);
        assert_eq!(std::fs::read_to_string(&todo).unwrap(), "drop 1234567 subject\n");
        assert!(!sequence.exists());
    }

    #[test]
    fn a_missing_sequence_cancels_the_rebase() {
        let dir = temp_dir("missing");
        let todo = dir.join(REBASE_TODO_FILE_NAME);
        std::fs::write(&todo, "pick 1234567 subject\n").unwrap();
        assert_eq!(edit_rebase_todo(&todo, None, Some(&dir.join("missing"))), CANCEL_REBASE);
        assert_eq!(edit_rebase_todo(&todo, None, None), CANCEL_REBASE);
    }
}
