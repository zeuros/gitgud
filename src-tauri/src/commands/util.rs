use std::env;

/// Returns the MD5 hex digest — mirrors Electron's crypto.md5.
#[tauri::command]
pub fn crypto_md5(data: String) -> String {
    format!("{:x}", md5::compute(data.as_bytes()))
}

/// Returns the current process environment variables.
#[tauri::command]
pub fn get_env() -> std::collections::HashMap<String, String> {
    env::vars().collect()
}

/// Returns the CPU architecture matching Node.js convention (x64 / arm64 / ia32).
#[tauri::command]
pub fn get_arch() -> &'static str {
    if cfg!(target_arch = "x86_64") {
        "x64"
    } else if cfg!(target_arch = "aarch64") {
        "arm64"
    } else if cfg!(target_arch = "x86") {
        "ia32"
    } else {
        "unknown"
    }
}

/// Returns the path of the current executable.
#[tauri::command]
pub fn get_exec_path() -> String {
    std::env::current_exe()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default()
}

/// Returns the OS platform string matching Node.js convention (linux / darwin / win32).
#[tauri::command]
pub fn get_platform() -> &'static str {
    if cfg!(target_os = "windows") {
        "win32"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    }
}

/// Opens a file manager at the given path — mirrors Electron's shell.showItemInFolder.
#[tauri::command]
pub fn show_item_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        // xdg-open opens the containing directory on most Linux DEs
        let parent = std::path::Path::new(&path)
            .parent()
            .map(|p| p.to_str().unwrap_or("/"))
            .unwrap_or("/");
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Resolves a path the same way Node's path.resolve does for the common 1-2 arg case.
#[tauri::command]
pub fn path_resolve(base: String, relative: Option<String>) -> String {
    let p = std::path::Path::new(&base);
    match relative {
        Some(rel) => p.join(&rel).to_string_lossy().into_owned(),
        None => p.to_string_lossy().into_owned(),
    }
}

/// Returns the directory part of a path — mirrors Node's path.dirname.
#[tauri::command]
pub fn path_dirname(path: String) -> String {
    std::path::Path::new(&path)
        .parent()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default()
}

/// Returns the file extension including the dot — mirrors Node's path.extname.
#[tauri::command]
pub fn path_extname(path: String) -> String {
    std::path::Path::new(&path)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default()
}
