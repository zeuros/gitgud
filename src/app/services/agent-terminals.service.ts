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

import {Injectable, signal} from '@angular/core';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import type {PtyInfo} from '../../typings';

export interface AgentTerminal extends PtyInfo {
  terminal: Terminal;
  fitAddon: FitAddon;
  /** Holds the terminal: moved into the agent view while it shows it, kept while it doesn't */
  element: HTMLElement;
}

const INITIAL_SIZE = {cols: 120, rows: 32};

/** Agents started from GitGud, each in a terminal drawn in the page, by their pid. They outlive a page reload. */
@Injectable({providedIn: 'root'})
export class AgentTerminalsService {

  terminals = signal(new Map<number, AgentTerminal>());
  /** Resolves once the agents still running from before a page reload are back, with whether the app just started */
  restored: Promise<{isAppStart: boolean}> = this.restore();

  /** Runs `program` in `cwd` in a new terminal, returning its pid */
  start = async (program: string, args: string[], cwd: string) => {
    const {terminal, fitAddon, element} = this.createTerminal();

    // The program may exit before its pid comes back
    let exited = false;
    let pid: number | undefined = undefined;
    pid = await window.tauri.pty.spawn(program, args, cwd, INITIAL_SIZE,
      data => terminal.write(new Uint8Array(data)),
      () => {
        exited = true;
        if (pid !== undefined) this.remove(pid);
      },
    );
    if (exited) {
      terminal.dispose();
      return pid;
    }
    this.add({pid, program, args, cwd, terminal, fitAddon, element});
    return pid;
  };

  private async restore() {
    const {isAppStart, terminals} = await window.tauri.pty.list().catch(() => ({isAppStart: true, terminals: []}));
    await Promise.all(terminals.map(async info => {
      const {terminal, fitAddon, element} = this.createTerminal();
      try {
        await window.tauri.pty.attach(info.pid, data => terminal.write(new Uint8Array(data)), () => this.remove(info.pid));
        this.add({...info, terminal, fitAddon, element});
      } catch {
        // It exited meanwhile
        terminal.dispose();
      }
    }));
    return {isAppStart};
  }

  private createTerminal = () => {
    const style = getComputedStyle(document.documentElement);
    const terminal = new Terminal({
      ...INITIAL_SIZE,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 13,
      cursorBlink: true,
      theme: {background: style.getPropertyValue('--p-content-background').trim() || undefined},
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    const element = document.createElement('div');
    element.style.height = '100%';
    terminal.open(element);
    return {terminal, fitAddon, element};
  };

  private add = (agentTerminal: AgentTerminal) => {
    const {pid, terminal} = agentTerminal;
    terminal.onData(data => window.tauri.pty.write(pid, data));
    terminal.onResize(size => window.tauri.pty.resize(pid, size));
    this.terminals.update(terminals => new Map(terminals).set(pid, agentTerminal));
  };

  private remove = (pid: number) => this.terminals.update(terminals => {
    terminals.get(pid)?.terminal.dispose();
    const remaining = new Map(terminals);
    remaining.delete(pid);
    return remaining;
  });
}
