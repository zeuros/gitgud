import {app, BrowserWindow, screen} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import {enable, initialize} from '@electron/remote/main';

let window: Electron.CrossProcessExports.BrowserWindow | null;
const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

function createMainWindow() {

  const displayWindowSize = screen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  window = new BrowserWindow({
    width: displayWindowSize.width,
    height: displayWindowSize.height,
    show: false, // Hide the main window initially
    webPreferences: {
      // preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      allowRunningInsecureContent: (serve),
      contextIsolation: false,
      webSecurity: false,
    },
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

const createSplashWindow = () => {
  let splash: BrowserWindow | null = new BrowserWindow({width: 512, height: 288 - 18, frame: false, alwaysOnTop: true, transparent: true});
  splash.loadFile('app/splash.html');
  splash.center();

  const mainWindow = createMainWindow();

  mainWindow.once('ready-to-show', () => {
    splash?.close();
    mainWindow.show();
    splash = null;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createSplashWindow);

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
  if (window === null) createMainWindow();
});
