use std::collections::HashMap;
use std::io::Write;
use std::process::{Command, Stdio};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ExecOptions {
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
}

#[derive(Serialize)]
pub struct ExecResult {
    pub stdout: String,
    pub stderr: String,
}

#[derive(Deserialize)]
pub struct SpawnOptions {
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
}

#[derive(Deserialize)]
pub struct SpawnSyncOptions {
    pub cwd: Option<String>,
    pub input: Option<String>,
    pub env: Option<HashMap<String, String>>,
}

#[derive(Serialize)]
pub struct SpawnSyncResult {
    pub stdout: String,
    pub stderr: String,
    pub status: Option<i32>,
}

/// Runs a command and collects all output — mirrors Electron's execFile.
///
/// On Unix, routes through the ShellPool (persistent bash processes keyed by cwd)
/// to avoid git exec overhead (10th of seconds saved) on successive git calls. Falls back to a direct
/// spawn when no cwd is provided or on non-Unix platforms.
#[tauri::command]
pub async fn exec_file(
    cmd: String,
    args: Vec<String>,
    options: ExecOptions,
    _pool: tauri::State<'_, crate::shell_pool::ShellPoolManager>,
) -> Result<ExecResult, String> {
    #[cfg(unix)]
    if let Some(cwd) = &options.cwd {
        if !cwd.is_empty() {
            let env = options.env.clone().unwrap_or_default();
            let stdout = _pool.exec(&cmd, &args, cwd, &env).await?;
            return Ok(ExecResult { stdout, stderr: String::new() });
        }
    }

    exec_file_direct(cmd, args, options).await
}

async fn exec_file_direct(
    cmd: String,
    args: Vec<String>,
    options: ExecOptions,
) -> Result<ExecResult, String> {
    let mut command = Command::new(&cmd);
    command.args(&args);
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    if let Some(cwd) = &options.cwd {
        command.current_dir(cwd);
    }
    if let Some(env) = &options.env {
        command.envs(env);
    }

    let output = command.output().map_err(|e| e.to_string())?;
    Ok(ExecResult {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

/// Runs a command with optional stdin input, collecting full output — mirrors Electron's spawnSync.
#[tauri::command]
pub fn spawn_sync_cmd(
    cmd: String,
    args: Vec<String>,
    options: SpawnSyncOptions,
) -> SpawnSyncResult {
    let mut command = Command::new(&cmd);
    command.args(&args);
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    if options.input.is_some() {
        command.stdin(Stdio::piped());
    } else {
        command.stdin(Stdio::null());
    }

    if let Some(cwd) = &options.cwd {
        command.current_dir(cwd);
    }
    if let Some(env) = &options.env {
        command.envs(env);
    }

    let mut child = match command.spawn() {
        Ok(c) => c,
        Err(e) => return SpawnSyncResult { stdout: String::new(), stderr: e.to_string(), status: Some(-1) },
    };

    if let Some(input) = &options.input {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(input.as_bytes());
        }
    }

    match child.wait_with_output() {
        Ok(output) => SpawnSyncResult {
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            status: output.status.code(),
        },
        Err(e) => SpawnSyncResult { stdout: String::new(), stderr: e.to_string(), status: Some(-1) },
    }
}

/// Runs a command asynchronously, collecting full output — mirrors Electron's spawn.
#[tauri::command]
pub async fn spawn_cmd(
    cmd: String,
    args: Vec<String>,
    options: SpawnOptions,
) -> Result<String, String> {
    let mut command = Command::new(&cmd);
    command.args(&args);
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    if let Some(cwd) = &options.cwd {
        command.current_dir(cwd);
    }
    if let Some(env) = &options.env {
        command.envs(env);
    }

    let output = command.output().map_err(|e| e.to_string())?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
        let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
        Ok(stdout + &stderr)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
        let code = output.status.code().unwrap_or(-1);
        Err(format!("Process exited with code {code}\n{stderr}"))
    }
}
