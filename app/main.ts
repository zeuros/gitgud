import {bindIpcFunctions} from "./ipc-functions";
import {app, BrowserWindow} from "electron";
import path from "path";

// @ts-ignore
let mainWindow;

const createWindow = () => {
    // @ts-ignore
  mainWindow = new BrowserWindow({
        width: 2600,
        height: 1600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.ts'),
            allowEval: true,
            nodeIntegration: true,
        }
    })


    // Dev stuff (todo: create config for prod builds)
    mainWindow.loadURL("http://localhost:4200/");
    // Open the DevTools.
    mainWindow.webContents.openDevTools()

    mainWindow.on('closed', () => mainWindow = null)
}

app
    .on('ready', createWindow)
    .on('window-all-closed', function () {
        if (process.platform !== 'darwin') app.quit();
    })
    .on('activate', () => {
        if (mainWindow === null) createWindow();
    })

bindIpcFunctions();
