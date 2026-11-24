use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// The `names` found on PATH, in the given order.
#[tauri::command]
pub fn find_programs(names: Vec<String>) -> Vec<String> {
    names.into_iter().filter(|name| find_on_path(name).is_some()).collect()
}

/// Opens the user's terminal in `cwd`, running `program` (an agent CLI found by `find_programs`).
#[tauri::command]
pub fn open_in_terminal(cwd: String, program: String) -> Result<(), String> {
    let mut command = terminal_command(&cwd, &program)?;
    command
        .current_dir(&cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    // The terminal outlives this call: its exit is never awaited
    command.spawn().map(drop).map_err(|e| e.to_string())
}

fn find_on_path(name: &str) -> Option<PathBuf> {
    let extensions: Vec<String> = if cfg!(windows) {
        std::env::var("PATHEXT")
            .unwrap_or_else(|_| ".EXE;.CMD;.BAT".into())
            .split(';')
            .map(str::to_lowercase)
            .collect()
    } else {
        vec![String::new()]
    };
    std::env::split_paths(&std::env::var_os("PATH")?)
        .flat_map(|dir| extensions.iter().map(move |ext| dir.join(format!("{name}{ext}"))))
        .find(|path| Path::new(path).is_file())
}

#[cfg(target_os = "linux")]
fn terminal_command(cwd: &str, program: &str) -> Result<Command, String> {
    // Debian's configured default first, then each desktop's own terminal
    let terminals: [(&str, &[&str]); 10] = [
        ("x-terminal-emulator", &["-e", program]),
        ("ptyxis", &["--new-window", "-d", cwd, "-x", program]),
        ("gnome-terminal", &["--working-directory", cwd, "--", program]),
        ("konsole", &["--workdir", cwd, "-e", program]),
        ("xfce4-terminal", &["--working-directory", cwd, "-x", program]),
        ("kitty", &["--directory", cwd, program]),
        ("alacritty", &["--working-directory", cwd, "-e", program]),
        ("wezterm", &["start", "--cwd", cwd, "--", program]),
        ("foot", &["-D", cwd, program]),
        ("xterm", &["-e", program]),
    ];
    let (terminal, args) = terminals
        .into_iter()
        .find(|(terminal, _)| find_on_path(terminal).is_some())
        .ok_or("No terminal found")?;
    let mut command = Command::new(terminal);
    command.args(args);
    Ok(command)
}

#[cfg(target_os = "macos")]
fn terminal_command(cwd: &str, program: &str) -> Result<Command, String> {
    let shell_quote = |s: &str| format!("'{}'", s.replace('\'', r"'\''"));
    let script = format!("cd {} && {}", shell_quote(cwd), shell_quote(program));
    let applescript_string = script.replace('\\', r"\\").replace('"', "\\\"");
    let mut command = Command::new("osascript");
    command.args([
        "-e",
        &format!("tell application \"Terminal\" to do script \"{applescript_string}\""),
        "-e",
        "tell application \"Terminal\" to activate",
    ]);
    Ok(command)
}

#[cfg(windows)]
fn terminal_command(cwd: &str, program: &str) -> Result<Command, String> {
    // `start` gives the program a console window of its own
    let mut command = Command::new("cmd");
    command.args(["/c", "start", "", "/D", cwd, program]);
    Ok(command)
}

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
fn terminal_command(_cwd: &str, _program: &str) -> Result<Command, String> {
    Err("Opening a terminal isn't supported on this platform".into())
}
