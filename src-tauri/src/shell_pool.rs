/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

//! Persistent-shell pool — Rust port of app/shell-pool.ts.
//!
//! Instead of fork+exec per git call (~30 ms each), we keep POOL_SIZE bash
//! processes alive per repo and pipe commands through stdin, reading stdout
//! until a unique sentinel tells us the command finished and its exit code.
//!
//! Protocol (bash):
//!   stdin  ← `'git' 'log' 2>/dev/null\nprintf '\nGITGUD_<id>:%d\n' $?\n`
//!   stdout → <git output>\n\nGITGUD_<id>:0\n   (exit code in sentinel)

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Child;
use tokio::sync::Mutex;

const POOL_SIZE: usize = 6;
static CMD_ID: AtomicU64 = AtomicU64::new(0);

// POSIX single-quote escaping: wrap in '', replace embedded ' with '\''
fn q(s: &str) -> String {
    format!("'{}'", s.replace('\'', r"'\''"))
}

// ---------------------------------------------------------------------------
// PersistentShell — one bash process with stdin/stdout pipes
// ---------------------------------------------------------------------------

struct Shell {
    stdin: tokio::process::ChildStdin,
    reader: BufReader<tokio::process::ChildStdout>,
    dead: bool,
    _child: Child, // keeps the process alive; drop sends EOF → bash exits
}

impl Shell {
    async fn spawn(cwd: &str, env: &HashMap<String, String>) -> Result<Self, String> {
        let mut child = tokio::process::Command::new("bash")
            .args(["--norc", "--noprofile"])
            .current_dir(cwd)
            .env_clear()
            .envs(env)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("shell spawn: {e}"))?;

        let stdin = child.stdin.take().ok_or("no stdin")?;
        let stdout = child.stdout.take().ok_or("no stdout")?;

        Ok(Shell { stdin, reader: BufReader::new(stdout), dead: false, _child: child })
    }

    async fn run(&mut self, cmd: &str, args: &[String]) -> Result<String, String> {
        let id = CMD_ID.fetch_add(1, Ordering::Relaxed);
        let sentinel = format!("GITGUD_{id}:");

        let quoted = std::iter::once(cmd)
            .chain(args.iter().map(String::as_str))
            .map(q)
            .collect::<Vec<_>>()
            .join(" ");

        // Send command + sentinel printer to the persistent shell.
        // Stderr is merged into stdout so non-zero exits include the git error message.
        let payload = format!("{quoted} 2>&1; _rc=$?; printf '\\nGITGUD_{id}:%d\\n' $_rc\n");
        if let Err(e) = self.stdin.write_all(payload.as_bytes()).await {
            self.dead = true;
            return Err(format!("stdin write: {e}"));
        }

        // Accumulate stdout lines until the sentinel line appears
        let mut output = String::new();
        loop {
            let mut line = String::new();
            match self.reader.read_line(&mut line).await {
                Ok(0) => {
                    self.dead = true;
                    return Err("shell closed unexpectedly".to_string());
                }
                Err(e) => {
                    self.dead = true;
                    return Err(format!("shell read: {e}"));
                }
                Ok(_) => {}
            }

            // Sentinel line: "GITGUD_<id>:<exit_code>\n"
            let trimmed = line.trim_end_matches(['\n', '\r']);
            if let Some(code_str) = trimmed.strip_prefix(&sentinel) {
                let code: i32 = code_str.parse().unwrap_or(-1);
                // Drop the blank line that printf's leading \n produced
                if output.ends_with('\n') { output.pop(); }
                return if code == 0 {
                    Ok(output)
                } else {
                    Err(format!("exited {code}\n{output}"))
                };
            }

            output.push_str(&line);
        }
    }
}

// ---------------------------------------------------------------------------
// Pool — POOL_SIZE shells for one (cwd, env) pair
// ---------------------------------------------------------------------------

struct Pool {
    semaphore: Arc<tokio::sync::Semaphore>,
    idle: Mutex<Vec<Shell>>,
    cwd: String,
    env: HashMap<String, String>,
}

impl Pool {
    fn new(cwd: String, env: HashMap<String, String>) -> Self {
        Pool {
            semaphore: Arc::new(tokio::sync::Semaphore::new(POOL_SIZE)),
            idle: Mutex::new(Vec::with_capacity(POOL_SIZE)),
            cwd,
            env,
        }
    }

    async fn exec(&self, cmd: &str, args: &[String]) -> Result<String, String> {
        // Limit concurrency to POOL_SIZE; permit is released AFTER shell is returned
        let _permit = self.semaphore.acquire().await.map_err(|e| e.to_string())?;

        // Grab an idle shell (or lazily spawn one on first / after death)
        let maybe = self.idle.lock().await.pop();
        let mut shell = match maybe {
            Some(s) if !s.dead => s,
            _ => Shell::spawn(&self.cwd, &self.env).await?,
        };

        let result = shell.run(cmd, args).await;

        // Return shell to idle list; replace dead ones so the pool self-heals
        if !shell.dead {
            self.idle.lock().await.push(shell);
        } else if let Ok(fresh) = Shell::spawn(&self.cwd, &self.env).await {
            self.idle.lock().await.push(fresh);
        }
        // _permit drops here → next waiter on the semaphore can proceed

        result
    }
}

// ---------------------------------------------------------------------------
// ShellPoolManager — global state registered with Tauri, one pool per cwd
// ---------------------------------------------------------------------------

pub struct ShellPoolManager {
    pools: Mutex<HashMap<String, Arc<Pool>>>,
}

impl ShellPoolManager {
    pub fn new() -> Self {
        Self { pools: Mutex::new(HashMap::new()) }
    }

    pub async fn exec(
        &self,
        cmd: &str,
        args: &[String],
        cwd: &str,
        env: &HashMap<String, String>,
    ) -> Result<String, String> {
        let pool = {
            let mut guard = self.pools.lock().await;
            guard
                .entry(cwd.to_string())
                .or_insert_with(|| Arc::new(Pool::new(cwd.to_string(), env.clone())))
                .clone()
        };
        pool.exec(cmd, args).await
    }
}
