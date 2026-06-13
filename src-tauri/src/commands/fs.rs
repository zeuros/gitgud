use std::fs;
use std::time::UNIX_EPOCH;

/// Lists directory entries — mirrors Electron's fs.readdirSync.
#[tauri::command]
pub fn fs_readdir(path: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let names = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| e.file_name().into_string().ok())
        .collect();
    Ok(names)
}

/// Returns true if the path is a file (not a directory).
#[tauri::command]
pub fn fs_is_file(path: String) -> Result<bool, String> {
    fs::metadata(&path)
        .map(|m| m.is_file())
        .map_err(|e| e.to_string())
}

/// Writes UTF-8 text to a file.
#[tauri::command]
pub fn fs_write_file(path: String, data: String) -> Result<(), String> {
    fs::write(&path, data.as_bytes()).map_err(|e| e.to_string())
}

/// Reads a file as a UTF-8 string.
#[tauri::command]
pub fn fs_read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Returns true if the path exists.
#[tauri::command]
pub fn fs_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

/// Returns the mtime of a file in milliseconds since Unix epoch.
#[tauri::command]
pub fn fs_mtime(path: String) -> Result<f64, String> {
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    let mtime = meta.modified().map_err(|e| e.to_string())?;
    let ms = mtime
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs_f64()
        * 1000.0;
    Ok(ms)
}
