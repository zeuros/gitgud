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

import {bootstrapApplication} from '@angular/platform-browser';
import {appConfig} from './app/app.config';
import {AppComponent} from './app/app.component';
import {ErrorHandler} from '@angular/core';
import {editor} from 'monaco-editor';
import {animationFrames, config, debounceTime, firstValueFrom, fromEvent, of, skip, startWith, switchMap, take, timeout} from 'rxjs';
import {installTauriBridge} from './app/api/tauri-bridge';
import {invoke} from '@tauri-apps/api/core';
import {GitRefreshService} from './app/services/git-refresh.service';

// Longest the splash screen waits for the repository to load before showing the main window anyway
const STARTUP_LOAD_TIMEOUT_MS = 2000;
// The window gets its restored size in several resizes after being shown: it is settled once they stop for this long
const WINDOW_SETTLE_QUIET_MS = 150;
const WINDOW_SETTLE_TIMEOUT_MS = 1500;

// Emits once the window stopped resizing and the layout that follows (log columns, canvas) was painted
const windowSettled = () => firstValueFrom(fromEvent(window, 'resize').pipe(
  startWith(null),
  debounceTime(WINDOW_SETTLE_QUIET_MS),
  switchMap(() => animationFrames().pipe(skip(1))),
  take(1),
  timeout({first: WINDOW_SETTLE_TIMEOUT_MS, with: () => of(null)}),
));

window.MonacoEnvironment = {
  getWorker(_: string, label: string): Worker {
    if (label === 'json') {
      return new Worker(new URL('./monaco-workers/json.worker', import.meta.url), {type: 'module'});
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new Worker(new URL('./monaco-workers/css.worker', import.meta.url), {type: 'module'});
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new Worker(new URL('./monaco-workers/html.worker', import.meta.url), {type: 'module'});
    }
    if (label === 'typescript' || label === 'javascript') {
      return new Worker(new URL('./monaco-workers/ts.worker', import.meta.url), {type: 'module'});
    }
    return new Worker(new URL('./monaco-workers/editor.worker', import.meta.url), {type: 'module'});
  }
};

editor.setTheme('vs-dark');

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    e.preventDefault();
    window.location.reload();
  }
});

// WebKitGTK on Linux doesn't reliably forward undo/redo to web inputs.
// execCommand is deprecated but remains the only way to drive the browser's undo buffer.
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const target = e.target as HTMLElement;
  if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;
  switch (e.key) {
    case 'z':
      e.preventDefault();
      document.execCommand(e.shiftKey ? 'redo' : 'undo');
      break;
    case 'y':
      if (!e.shiftKey) { e.preventDefault(); document.execCommand('redo'); }
      break;
    case 'a':
      e.preventDefault();
      (target as HTMLInputElement | HTMLTextAreaElement).select();
      break;
  }
});

installTauriBridge()
  .catch(err => console.error('[tauri-bridge] init failed, falling back to stub:', err))
  .then(() => bootstrapApplication(AppComponent, appConfig))
  .then(appRef => {
    const globalErrorHandler = appRef.injector.get(ErrorHandler);
    config.onUnhandledError = err => globalErrorHandler.handleError(err);
    window.addEventListener('unhandledrejection', (event) => {
      globalErrorHandler.handleError(event.reason);
      event.preventDefault();
    });
    return firstValueFrom(appRef.injector.get(GitRefreshService).appReady$.pipe(timeout({first: STARTUP_LOAD_TIMEOUT_MS, with: () => of(true)})));
  })
  .catch(err => console.error('[bootstrap] Angular failed to start:', err))
  // The main window starts hidden behind the splash screen window: show it once the repository is loaded, or if the app failed to start,
  // see-through until its layout settled
  .finally(() => invoke('show_main_window')
    .then(windowSettled)
    .finally(() => document.documentElement.classList.remove('starting'))
    .then(() => invoke('close_splashscreen'))
    .catch(console.error));

