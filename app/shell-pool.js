"use strict";
/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShellPool = void 0;
const node_child_process_1 = require("node:child_process");
const IS_WIN = process.platform === 'win32';
// bash:        '\'' to escape a single quote inside single-quoted strings
// PowerShell:  '' to escape a single quote inside single-quoted strings
const q = IS_WIN
    ? s => "'" + s.replace(/'/g, "''") + "'"
    : s => "'" + s.replace(/'/g, "'\\''") + "'";
// Builds the stdin payload sent to the persistent shell for one command:
// invoke the command (stderr suppressed), then write the exit-code sentinel.
//
// PowerShell notes:
//   & invokes executables by name/path; $LASTEXITCODE holds native exit codes.
//   [Console]::Write bypasses the TextWriter pipeline; Out.Flush() forces
//   the sentinel through immediately since Console.Out buffers on piped stdout.
function shellCmd(cmd, args, id) {
    const quoted = [cmd, ...args].map(q).join(' ');
    if (IS_WIN) {
        return `& ${quoted} 2>$null\n[Console]::Write("\`nGITGUD_${id}:$LASTEXITCODE\`n");[Console]::Out.Flush()\n`;
    }
    return `${quoted} 2>/dev/null\nprintf '\\nGITGUD_${id}:%d\\n' $?\n`;
}
class PersistentShell {
    constructor(cwd, env) {
        this.buf = '';
        this.queue = [];
        this.dead = false;
        const shell = IS_WIN ? 'powershell.exe' : 'bash';
        // PowerShell: a while+ReadLine loop reads and evaluates commands one line at
        // a time as they arrive — the persistent-shell equivalent of bash's stdin loop.
        const shellArgs = IS_WIN
            ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'while(($line=[Console]::ReadLine()) -ne $null){Invoke-Expression $line}']
            : ['--norc', '--noprofile'];
        this.proc = (0, node_child_process_1.spawn)(shell, shellArgs, { cwd, env, stdio: 'pipe' });
        this.proc.stdout.on('data', (d) => {
            this.buf += d.toString('utf8');
            this.drain();
        });
        // Drain stderr to prevent write-blocking if the shell emits there.
        this.proc.stderr.on('data', () => { });
        this.proc.on('close', () => {
            this.dead = true;
            this.queue.splice(0).forEach(p => p.reject(new Error('shell closed')));
        });
    }
    drain() {
        while (this.queue.length) {
            const { id, resolve, reject } = this.queue[0];
            const sentinel = `\nGITGUD_${id}:`;
            const idx = this.buf.indexOf(sentinel);
            if (idx === -1)
                return;
            const stdout = this.buf.slice(0, idx);
            const after = this.buf.slice(idx + sentinel.length);
            const nl = after.indexOf('\n');
            const exitCode = parseInt(after.slice(0, nl), 10);
            this.buf = after.slice(nl + 1);
            this.queue.shift();
            if (exitCode === 0) {
                resolve(stdout);
            }
            else {
                reject(Object.assign(new Error(`git exited ${exitCode}`), { exitCode, stdout }));
            }
        }
    }
    run(cmd, args) {
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
        this.proc.stdin.write(shellCmd(cmd, args, id));
        return new Promise((resolve, reject) => this.queue.push({ id, resolve, reject }));
    }
    close() {
        this.proc.stdin.end();
    }
}
class ShellPool {
    constructor(cwd, env, size = 6) {
        this.cwd = cwd;
        this.env = env;
        this.idle = [];
        this.waiting = [];
        for (let i = 0; i < size; i++)
            this.idle.push(new PersistentShell(cwd, env));
    }
    acquire() {
        for (let i = 0; i < this.idle.length; i++) {
            if (!this.idle[i].dead)
                return Promise.resolve(this.idle.splice(i, 1)[0]);
        }
        return new Promise(resolve => this.waiting.push(resolve));
    }
    release(shell) {
        const s = shell.dead ? new PersistentShell(this.cwd, this.env) : shell;
        if (this.waiting.length)
            this.waiting.shift()(s);
        else
            this.idle.push(s);
    }
    exec(cmd, args) {
        return this.acquire().then(shell => shell.run(cmd, args).finally(() => this.release(shell)));
    }
    close() {
        this.idle.forEach(s => s.close());
        this.idle = [];
    }
}
exports.ShellPool = ShellPool;
//# sourceMappingURL=shell-pool.js.map