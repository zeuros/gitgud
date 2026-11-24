/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

mod commands;
pub mod credential_helper;
pub mod sequence_editor;
mod shell_pool;

use commands::{agent::*, fs::*, process::*, util::*, watcher::*};
use tauri_plugin_window_state::StateFlags;

const FALLBACK_PATHS: &[&str] = &["/usr/local/bin", "/usr/bin", "/bin", "/opt/homebrew/bin"];

// Packaged apps on Linux/macOS may launch without a login shell, stripping PATH.
// Prepend standard binary locations so 'git' resolves without user config.
fn patch_path() {
    let current = std::env::var("PATH").unwrap_or_default();
    let existing: Vec<&str> = current.split(':').collect();
    let missing: Vec<&str> = FALLBACK_PATHS
        .iter()
        .filter(|p| !existing.contains(p))
        .copied()
        .collect();
    if !missing.is_empty() {
        let new_path = format!("{}:{}", missing.join(":"), current);
        std::env::set_var("PATH", new_path);
    }
}

// Apps launched from the desktop environment don't inherit the PATH a terminal gets from the shell rc files
// (fnm/nvm/pyenv…), so git hooks calling `npx`, `node`, `python`… fail in GitGud while working in a terminal.
// Ask the user's login shell for its PATH once, and put it first. Bounded: a slow or broken rc must not block startup.
#[cfg(unix)]
fn patch_path_from_login_shell() {
    const MARK: &str = "__GITGUD_PATH__";
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let out = std::process::Command::new(shell)
            .args(["-ilc", &format!("printf '{MARK}%s{MARK}' \"$PATH\"")])
            .stdin(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .output();
        let _ = tx.send(out);
    });
    let Ok(Ok(out)) = rx.recv_timeout(std::time::Duration::from_secs(3)) else { return };
    let stdout = String::from_utf8_lossy(&out.stdout);
    // rc files may print banners around the marked value
    let Some(login_path) = stdout.split(MARK).nth(1).filter(|p| !p.is_empty()) else { return };

    let current = std::env::var("PATH").unwrap_or_default();
    let mut merged: Vec<&str> = login_path.split(':').collect();
    let login_len = merged.len();
    let extra: Vec<&str> = current.split(':').filter(|p| !merged[..login_len].contains(p)).collect();
    merged.extend(extra);
    std::env::set_var("PATH", merged.join(":"));
}

// With NVIDIA the web process leaks GPU sync fences (anon_inode:sync_file) and dies with "Too many open files" once it
// reaches the soft limit (1024 for apps launched from GNOME). Raise it to the hard limit, inherited by the web process.
#[cfg(target_os = "linux")]
fn raise_open_files_limit() {
    let mut limit = libc::rlimit { rlim_cur: 0, rlim_max: 0 };
    // SAFETY: plain syscalls on a local struct
    unsafe {
        if libc::getrlimit(libc::RLIMIT_NOFILE, &mut limit) == 0 && limit.rlim_cur < limit.rlim_max {
            limit.rlim_cur = limit.rlim_max;
            libc::setrlimit(libc::RLIMIT_NOFILE, &limit);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(unix)]
    patch_path_from_login_shell();
    patch_path();
    sequence_editor::expose_binary_name();
    credential_helper::configure_git();
    #[cfg(target_os = "linux")]
    raise_open_files_limit();

    tauri::Builder::default()
        .manage(shell_pool::ShellPoolManager::new())
        .plugin(tauri_plugin_prevent_default::with_flags(tauri_plugin_prevent_default::Flags::CONTEXT_MENU))
        .plugin(
            // Decorations come from the config (the app draws its title bar): a saved state would restore the native one.
            // The main window starts hidden behind the splash screen: restoring its saved visibility would show it early
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() - StateFlags::DECORATIONS - StateFlags::VISIBLE)
                .with_denylist(&["splashscreen"])
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            // fs
            fs_readdir,
            fs_is_file,
            fs_write_file,
            fs_read_file,
            fs_read_file_bytes,
            fs_size,
            fs_exists,
            fs_mtime,
            // process
            exec_file,
            exec_file_bytes,
            spawn_sync_cmd,
            spawn_cmd,
            find_processes,
            // watcher
            watch_paths,
            close_watcher,
            close_all_watchers,
            // util
            crypto_md5,
            get_env,
            get_platform,
            get_arch,
            get_package_format,
            get_build_commit,
            show_item_in_folder,
            show_main_window,
            close_splashscreen,
            // agent
            find_programs,
            open_in_terminal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
