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
import {config} from 'rxjs';
import {installTauriBridge} from './app/api/tauri-bridge';

(window as any).MonacoEnvironment = {
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
  })
  .catch(err => console.error('[bootstrap] Angular failed to start:', err));
