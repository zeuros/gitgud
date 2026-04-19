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

import {app, BrowserWindow, screen} from 'electron';
import {join} from 'node:path';
import {enable, initialize} from '@electron/remote/main';

let mainWindow: BrowserWindow | null;
// let splashWindow: BrowserWindow | null;

const isDev = process.argv.slice(1).includes('--serve');

// -----------------------------
// Preload & Remote initialization
// -----------------------------
initialize();

// -----------------------------
// Create main application window
// -----------------------------
function createMainWindow() {
  const {width, height} = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, 'icons/gitgud-logo.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,  // required when preload uses Node built-ins
      webSecurity: !isDev,
    },
  });

  // Must be called immediately after window creation, before loadURL/loadFile
  enable(mainWindow.webContents);

  if (isDev) {
    mainWindow.loadURL('http://localhost:4200');
  } else {
      mainWindow.loadFile(join(process.resourcesPath, 'dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// -----------------------------
// Splash screen
// -----------------------------
function createSplashWindow() {
  let splashWindow: BrowserWindow | null = new BrowserWindow({
    width: 512,
    height: 270,
    icon: join(__dirname, 'icons/gitgud-logo.png'),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
  });

  splashWindow.loadFile(join(__dirname, 'splash.html'));
  splashWindow.center();

  const mainWin = createMainWindow();

  // Show main window once ready, then close splash
  mainWin.once('ready-to-show', () => {
    splashWindow?.close();
    splashWindow = null;
    mainWin.show();
    mainWin.focus();
    if (isDev) mainWin.webContents.openDevTools();
  });
}

// -----------------------------
// App lifecycle events
// -----------------------------
app.whenReady().then(() => {

  createSplashWindow();

  // macOS: re-create window if dock icon clicked with no windows open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createSplashWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});