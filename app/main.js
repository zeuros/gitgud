"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ipc_functions_1 = require("./ipc-functions");
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
// @ts-ignore
let mainWindow;
const createWindow = () => {
    // @ts-ignore
    mainWindow = new electron_1.BrowserWindow({
        width: 2600,
        height: 1600,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.ts'),
            allowEval: true,
            nodeIntegration: true,
        }
    });
    // Dev stuff (todo: create config for prod builds)
    mainWindow.loadURL("http://localhost:4200/");
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
    mainWindow.on('closed', () => mainWindow = null);
};
electron_1.app
    .on('ready', createWindow)
    .on('window-all-closed', function () {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
})
    .on('activate', () => {
    if (mainWindow === null)
        createWindow();
});
(0, ipc_functions_1.bindIpcFunctions)();
//# sourceMappingURL=main.js.map