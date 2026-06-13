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
mod shell_pool;

use commands::{fs::*, process::*, util::*, watcher::*};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    patch_path();

    // Force XWayland — WebKitGTK's native Wayland backend is broken on many distros.
    // GDK_BACKEND=x11 makes GTK bypass Wayland entirely, so the compositor error
    // (Error 71) never occurs.
    // WEBKIT_DISABLE_DMABUF_RENDERER=1 stops WebKit's own DMA-BUF/GBM compositing layer,
    // which fails on NVIDIA proprietary drivers even under XWayland (GBM buffer Invalid argument).
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("GDK_BACKEND", "x11");
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .manage(shell_pool::ShellPoolManager::new())
        .plugin(tauri_plugin_prevent_default::with_flags(tauri_plugin_prevent_default::Flags::CONTEXT_MENU))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                if let Some(win) = _app.get_webview_window("main") {
                    win.open_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // fs
            fs_readdir,
            fs_is_file,
            fs_write_file,
            fs_read_file,
            fs_exists,
            fs_mtime,
            // process
            exec_file,
            spawn_sync_cmd,
            spawn_cmd,
            // watcher
            watch_paths,
            close_watcher,
            close_all_watchers,
            // util
            crypto_md5,
            get_env,
            get_platform,
            get_arch,
            get_exec_path,
            show_item_in_folder,
            path_resolve,
            path_dirname,
            path_extname,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
