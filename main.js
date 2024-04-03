const {app, BrowserWindow, ipcMain} = require('electron')
const Git = require('nodegit');
const url = require("url");
const path = require("path");

let mainWindow

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
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


ipcMain.on('git-clone', async (event, ...args) => {
    event.returnValue = await Git.Clone('git://some-host/path', 'local-path', null, function (err, repo) {
        console.log(repo.path())
    });
});
