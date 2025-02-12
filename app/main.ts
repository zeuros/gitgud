import {app, BrowserWindow, screen} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import {initialize, enable} from "@electron/remote/main";

let window: Electron.CrossProcessExports.BrowserWindow | null;
const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

function createWindow() {


  const displayWindowSize = screen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  window = new BrowserWindow({
    width: displayWindowSize.width,
    height: displayWindowSize.height,
    webPreferences: {
      // preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      allowRunningInsecureContent: (serve),
      contextIsolation: false,
    }
  });

  // Initialize remote api, it's like ipc but much more simple, and avoiding the hassle of re-typing in front / back.
  initialize();
  enable(window.webContents);

  if (serve) {
    const debug = require('electron-debug');
    debug();

    require('electron-reloader')(module);
    window.loadURL('http://localhost:4200');
  } else {
    // Path when running electron executable
    let pathIndex = './index.html';

    if (fs.existsSync(path.join(__dirname, '../dist/index.html'))) {
      // Path when running electron in local folder
      pathIndex = '../dist/index.html';
    }

    const url = new URL(path.join('file:', __dirname, pathIndex));
    window.loadURL(url.href);
  }

  window.on('closed', () => {
    // Dereference the window object, usually you would store window
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    window = null;
  });

  return window;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
app.on('ready', () => setTimeout(createWindow, 400));

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (window === null) createWindow();
});
