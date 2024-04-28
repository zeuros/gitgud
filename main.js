const {app, BrowserWindow, ipcMain} = require('electron')
const git = require('isomorphic-git')
const http = require('isomorphic-git/http/node')
const path = require("path");
const fs = require('fs')
const { spawn } = require('child_process')
const { URL } = require('url')

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


    // Dev stuff (todo: create config for prod builds)
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

async function onAuth (url) {
  const { protocol, host } = new URL(url)
  return new Promise((resolve, reject) => {
    const output = []
    const process = spawn('git', ['credential', 'fill'])
    process.on('close', (code) => {
      if (code) return reject(code)
      const { username, password } = output.join('\n').split('\n').reduce((acc, line) => {
        if (line.startsWith('username') || line.startsWith('password')) {
          const [ key, val ] = line.split('=')
          acc[key] = val
        }
        return acc
      }, {})
      resolve({ username, password })
    })
    process.stdout.on('data', (data) => output.push(data.toString().trim()))
    process.stdin.write(`protocol=${protocol.slice(0, -1)}\nhost=${host}\n\n`)
  })
}


// FS functions

ipcMain.handle('sample-error', async (event, ...args) => {throw 'wops !';});
ipcMain.handle('read-directory', async (event, dir) => await fs.readdir(dir));
ipcMain.handle('write-file', async (event, path, data) => await fs.writeFile(path, data));
ipcMain.handle('unlink', async (event, path) => await fs.unlink(path));


// TODO: move ipc api in other file
ipcMain.handle('git-clone', async (event, url, dir) => await git.clone({fs, http, dir, url, onAuth}));
ipcMain.handle('git-errors', async (event, ...args) => await git.Errors);
ipcMain.handle('git-stage', async (event, ...args) => await git.STAGE());
ipcMain.handle('git-tree', async (event, ...args) => await git.TREE(args));
ipcMain.handle('git-workdir', async (event, ...args) => await git.WORKDIR());
ipcMain.handle('git-add', async (event, dir, filepath) => await git.add({fs, dir, filepath}));
ipcMain.handle('git-add-all', async (event, repo, filepath) => git.statusMatrix(repo).then((statuses) =>
    Promise.all(statuses.map(([filepath, , worktreeStatus]) => worktreeStatus ? git.add({...repo, filepath}) : git.remove({...repo, filepath})))
));
ipcMain.handle('git-abort-merge', async (event, ...args) => await git.abortMerge(args));
ipcMain.handle('git-add-note', async (event, ...args) => await git.addNote(args));
ipcMain.handle('git-add-remote', async (event, ...args) => await git.addRemote(args));
ipcMain.handle('git-annotated-tag', async (event, ...args) => await git.annotatedTag(args));
ipcMain.handle('git-branch', async (event, ...args) => await git.branch(args));
ipcMain.handle('git-checkout', async (event, ...args) => await git.checkout(args));
ipcMain.handle('git-commit', async (event, dir, message, author) => await git.commit({fs, dir, message, author}));
ipcMain.handle('git-get-config', async (event, ...args) => await git.getConfig(args));
ipcMain.handle('git-get-config-all', async (event, ...args) => await git.getConfigAll(args));
ipcMain.handle('git-set-config', async (event, ...args) => await git.setConfig(args));
ipcMain.handle('git-current-branch', async (event, ...args) => await git.currentBranch(args));
ipcMain.handle('git-delete-branch', async (event, ...args) => await git.deleteBranch(args));
ipcMain.handle('git-delete-ref', async (event, ...args) => await git.deleteRef(args));
ipcMain.handle('git-delete-remote', async (event, ...args) => await git.deleteRemote(args));
ipcMain.handle('git-delete-tag', async (event, ...args) => await git.deleteTag(args));
ipcMain.handle('git-expand-oid', async (event, ...args) => await git.expandOid(args));
ipcMain.handle('git-expand-ref', async (event, ...args) => await git.expandRef(args));
ipcMain.handle('git-fast-forward', async (event, ...args) => await git.fastForward(args));
ipcMain.handle('git-fetch', async (event, ...args) => await git.fetch(args));
ipcMain.handle('git-find-merge-base', async (event, ...args) => await git.findMergeBase(args));
ipcMain.handle('git-find-root', async (event, ...args) => await git.findRoot(args));
ipcMain.handle('git-get-remote-info', async (event, ...args) => await git.getRemoteInfo(args));
ipcMain.handle('git-get-remote-info-2', async (event, ...args) => await git.getRemoteInfo2(args));
ipcMain.handle('git-hash-blob', async (event, ...args) => await git.hashBlob(args));
ipcMain.handle('git-index-pack', async (event, ...args) => await git.indexPack(args));
ipcMain.handle('git-init', async (event, ...args) => await git.init(args));
ipcMain.handle('git-is-descendent', async (event, ...args) => await git.isDescendent(args));
ipcMain.handle('git-is-ignored', async (event, ...args) => await git.isIgnored(args));
ipcMain.handle('git-list-branches', async (event, ...args) => await git.listBranches(args));
ipcMain.handle('git-list-files', async (event, ...args) => await git.listFiles(args));
ipcMain.handle('git-list-notes', async (event, ...args) => await git.listNotes(args));
ipcMain.handle('git-list-remotes', async (event, ...args) => await git.listRemotes(args));
ipcMain.handle('git-list-server-refs', async (event, ...args) => await git.listServerRefs(args));
ipcMain.handle('git-list-tags', async (event, ...args) => await git.listTags(args));
ipcMain.handle('git-log', async (event, dir, depth = 1) => await git.log({fs, dir, depth}));
ipcMain.handle('git-merge', async (event, ...args) => await git.merge(args));
ipcMain.handle('git-pack-objects', async (event, ...args) => await git.packObjects(args));
ipcMain.handle('git-pull', async (event, ...args) => await git.pull(args));
ipcMain.handle('git-push', async (event, ...args) => await git.push(args));
ipcMain.handle('git-read-blob', async (event, ...args) => await git.readBlob(args));
ipcMain.handle('git-read-commit', async (event, ...args) => await git.readCommit(args));
ipcMain.handle('git-read-note', async (event, ...args) => await git.readNote(args));
ipcMain.handle('git-read-object', async (event, ...args) => await git.readObject(args));
ipcMain.handle('git-read-tag', async (event, ...args) => await git.readTag(args));
ipcMain.handle('git-read-tree', async (event, ...args) => await git.readTree(args));
ipcMain.handle('git-remove', async (event, dir, filepath) => await git.remove({fs, dir, filepath}));
ipcMain.handle('git-remove-note', async (event, ...args) => await git.removeNote(args));
ipcMain.handle('git-rename-branch', async (event, ...args) => await git.renameBranch(args));
ipcMain.handle('git-reset-index', async (event, ...args) => await git.resetIndex(args));
ipcMain.handle('git-update-index', async (event, ...args) => await git.updateIndex(args));
ipcMain.handle('git-resolve-ref', async (event, ...args) => await git.resolveRef(args));
ipcMain.handle('git-status', async (event, dir, filepath) => await git.status({fs, dir, filepath/*ex: readme.md*/}));
ipcMain.handle('git-status-matrix', async (event, ...args) => await git.statusMatrix(args));
ipcMain.handle('git-tag', async (event, ...args) => await git.tag(args));
ipcMain.handle('git-version', async (event, ...args) => await git.version(args));
ipcMain.handle('git-walk', async (event, ...args) => await git.walk(args));
ipcMain.handle('git-write-blob', async (event, ...args) => await git.writeBlob(args));
ipcMain.handle('git-write-commit', async (event, ...args) => await git.writeCommit(args));
ipcMain.handle('git-write-object', async (event, ...args) => await git.writeObject(args));
ipcMain.handle('git-write-ref', async (event, ...args) => await git.writeRef(args));
ipcMain.handle('git-write-tag', async (event, ...args) => await git.writeTag(args));
ipcMain.handle('git-write-tree', async (event, ...args) => await git.writeTree(args));



