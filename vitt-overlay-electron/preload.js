const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  onClickThrough: (cb) => ipcRenderer.on('overlay:clickThrough', (_e, val) => cb(val))
});
