const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('gitTools', {
  clone: (repositoryUrl, directory) => ipcRenderer.invoke('git-clone', repositoryUrl, directory)
})