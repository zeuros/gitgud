const {app, BrowserWindow} = require('electron');
const path = require("path");
const {bindIpcFunctions} = require("./src/ipc-functions");

let mainWindow;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 2600,
        height: 1600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
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
