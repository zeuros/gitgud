use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use tauri::ipc::{Channel, InvokeResponseBody};

/// A program running in a pseudo-terminal the page draws (xterm.js). It outlives the page: a reloaded page attaches
/// to it again.
struct Pty {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    info: PtyInfo,
    output: Arc<Mutex<PtyOutput>>,
}

/// Where the program's output goes, and its last bytes, replayed to a page attaching
struct PtyOutput {
    recent: Vec<u8>,
    on_output: Channel<InvokeResponseBody>,
    on_exit: Channel<u32>,
}

#[derive(Clone, Serialize)]
pub struct PtyInfo {
    pid: u32,
    program: String,
    args: Vec<String>,
    cwd: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyList {
    /// Whether this is the app's first page, rather than a reloaded one
    is_app_start: bool,
    terminals: Vec<PtyInfo>,
}

/// By the pid of the program they run
static PTYS: LazyLock<Mutex<HashMap<u32, Pty>>> = LazyLock::new(Default::default);
static LISTED: AtomicBool = AtomicBool::new(false);

const READ_BUFFER_BYTES: usize = 16 * 1024;
const RECENT_OUTPUT_BYTES: usize = 512 * 1024;

fn size(cols: u16, rows: u16) -> PtySize {
    PtySize { rows, cols, pixel_width: 0, pixel_height: 0 }
}

/// Appends `data` to `recent`, keeping its last `max_bytes`
fn keep_recent(recent: &mut Vec<u8>, data: &[u8], max_bytes: usize) {
    recent.extend_from_slice(data);
    if recent.len() > max_bytes {
        recent.drain(..recent.len() - max_bytes);
    }
}

/// Runs `program` in a new pseudo-terminal, returning its pid. Its output is sent to `on_output` as raw bytes,
/// then its exit code to `on_exit`.
#[tauri::command]
pub fn pty_spawn(
    program: String,
    args: Vec<String>,
    cwd: String,
    cols: u16,
    rows: u16,
    on_output: Channel<InvokeResponseBody>,
    on_exit: Channel<u32>,
) -> Result<u32, String> {
    let pair = native_pty_system().openpty(size(cols, rows)).map_err(|e| e.to_string())?;
    let mut command = CommandBuilder::new(&program);
    command.args(&args);
    command.cwd(&cwd);
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    let mut child = pair.slave.spawn_command(command).map_err(|e| e.to_string())?;
    // The program holds the terminal's other end: this one closing lets reads end when it exits
    drop(pair.slave);

    let pid = child.process_id().ok_or("The program has no pid")?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let killer = child.clone_killer();
    let output = Arc::new(Mutex::new(PtyOutput { recent: Vec::new(), on_output, on_exit }));
    let info = PtyInfo { pid, program, args, cwd };
    PTYS.lock().unwrap().insert(pid, Pty { master: pair.master, writer, killer, info, output: output.clone() });

    std::thread::spawn(move || {
        let mut buffer = [0u8; READ_BUFFER_BYTES];
        while let Ok(read) = reader.read(&mut buffer) {
            if read == 0 {
                break;
            }
            let mut output = output.lock().unwrap();
            keep_recent(&mut output.recent, &buffer[..read], RECENT_OUTPUT_BYTES);
            // A reloading page is gone until it attaches again: the program keeps running meanwhile
            let _ = output.on_output.send(InvokeResponseBody::Raw(buffer[..read].to_vec()));
        }
        let exit_code = child.wait().map(|status| status.exit_code()).unwrap_or(1);
        PTYS.lock().unwrap().remove(&pid);
        let _ = output.lock().unwrap().on_exit.send(exit_code);
    });
    Ok(pid)
}

/// The programs running in a terminal, e.g. for a reloaded page to attach to them
#[tauri::command]
pub fn pty_list() -> PtyList {
    PtyList {
        is_app_start: !LISTED.swap(true, Ordering::Relaxed),
        terminals: PTYS.lock().unwrap().values().map(|pty| pty.info.clone()).collect(),
    }
}

/// Sends the program's recent output to `on_output`, then the output to come, and its exit code to `on_exit`
#[tauri::command]
pub fn pty_attach(pid: u32, on_output: Channel<InvokeResponseBody>, on_exit: Channel<u32>) -> Result<(), String> {
    let output = PTYS.lock().unwrap().get(&pid).ok_or("No such terminal")?.output.clone();
    let mut output = output.lock().unwrap();
    on_output.send(InvokeResponseBody::Raw(output.recent.clone())).map_err(|e| e.to_string())?;
    output.on_output = on_output;
    output.on_exit = on_exit;
    Ok(())
}

/// Types `data` (keys, pasted text) into the terminal of the program `pid`
#[tauri::command]
pub fn pty_write(pid: u32, data: String) -> Result<(), String> {
    let mut ptys = PTYS.lock().unwrap();
    let pty = ptys.get_mut(&pid).ok_or("No such terminal")?;
    pty.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_resize(pid: u32, cols: u16, rows: u16) -> Result<(), String> {
    let ptys = PTYS.lock().unwrap();
    let pty = ptys.get(&pid).ok_or("No such terminal")?;
    pty.master.resize(size(cols, rows)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_kill(pid: u32) -> Result<(), String> {
    let mut ptys = PTYS.lock().unwrap();
    let pty = ptys.get_mut(&pid).ok_or("No such terminal")?;
    pty.killer.kill().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_the_last_bytes() {
        let mut recent = b"abc".to_vec();
        keep_recent(&mut recent, b"defg", 5);
        assert_eq!(recent, b"cdefg");
        keep_recent(&mut recent, b"h", 10);
        assert_eq!(recent, b"cdefgh");
    }
}
