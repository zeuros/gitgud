const {app, BrowserWindow, ipcMain} = require('electron')
const git = require('isomorphic-git')
const http = require('isomorphic-git/http/node')
const url = require("url");
const path = require("path");
const fs = require('fs')

let mainWindow

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 2600,
        height: 1600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            allowEval: true,
            nodeIntegration: true
        }
    })


    // Dev stuff (todo: don't put it for prod builds)
    mainWindow.loadURL("http://localhost:4200/");
    // Open the DevTools.
    mainWindow.webContents.openDevTools()

    mainWindow.on('closed', () => mainWindow = null)
}

app.on('ready', createWindow)

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
    if (mainWindow === null) createWindow()
})


ipcMain.handle('git-clone', async (event, url, dir) => await git.clone({fs, http, dir, url}));
ipcMain.handle('sample-error', async (event, ...args) => {throw 'wops !';});


