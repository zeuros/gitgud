const {app, BrowserWindow, ipcMain} = require('electron')
const git = require('isomorphic-git')
const http = require('isomorphic-git/http/node')
const url = require("url");
const path = require("path");
const fs = require('fs')

let mainWindow

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            allowEval: true,
            nodeIntegration: true
        }
    })

    mainWindow.loadURL(
        url.format({
            pathname: path.join(__dirname, `/dist/index.html`),
            protocol: "file:",
            slashes: true
        })
    );
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


const dir = path.join(process.cwd(), 'test-clone')
ipcMain.on('git-clone', async (event, ...args) => {
    console.log('ttest');
    //const dir = path.join(process.cwd(), 'test-clone')
    //event.returnValue = await git.clone({fs, http, dir, url: 'https://github.com/isomorphic-git/lightning-fs'});
});
