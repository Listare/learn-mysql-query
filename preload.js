const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
  executeSQL: (initSqls, querySql) => ipcRenderer.invoke('executeSql', initSqls, querySql),
})