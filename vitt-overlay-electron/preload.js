const { contextBridge, ipcRenderer } = require('electron');

console.log("Preload loaded");

contextBridge.exposeInMainWorld('overlay', {
  onClickThrough: (cb) => ipcRenderer.on('overlay:clickThrough', (_e, val) => cb(val)),
  somethingHappened: (cb) => ipcRenderer.on('something-happened', (_e, data) => cb(data)),
  getRecallBuffer: (cb) => {
    const subscription = (_event, data) => cb(data);
    ipcRenderer.on('recall-buffer', subscription);
    return () => ipcRenderer.removeListener('recall-buffer', subscription);
  },
  getMeetingId: (cb) => {
    const subscription = (_event, data) => cb(data);
    ipcRenderer.on('current-window-id', subscription);
    return () => ipcRenderer.removeListener('current-window-id', subscription);
  },
  meetingDetected: (cb) => {
    const subscription = (_event, data) => cb(data);
    ipcRenderer.on('meeting-detected', subscription);
    return () => ipcRenderer.removeListener('meeting-detected', subscription);
  },
  meetingClosed: (cb) => {
    const subscription = (_event, data) => cb(data);
    ipcRenderer.on('meeting-closed', subscription);
    return () => ipcRenderer.removeListener('meeting-closed', subscription);
  },
  quitApp: () => ipcRenderer.send('close-app'),
  minimizeApp: () => ipcRenderer.send('minimize-app'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  resizeWindow: (payload) => ipcRenderer.send('resize-window', payload),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  getWindowSize: () => ipcRenderer.invoke('get-window-size'),
  onWindowResized: (cb) => {
    const subscription = (_event, data) => cb(data);
    ipcRenderer.on('window-resized', subscription);
    return () => ipcRenderer.removeListener('window-resized', subscription);
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  ipcRenderer: {
    send: (channel, data) => {
      const validChannels = ['message-from-renderer', 'api-key', 'log', 'close-app', 'minimize-app', 'open-external', 'resize-window', 'toggle-fullscreen'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    on: (channel, func) => {
      const validChannels = ['message-from-main', 'state', 'api-key', 'log', 'detected-meetings', 'current-window-id', 'recall-buffer'];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (_event, ...args) => func(...args));
      }
    },
    removeAllListeners: (channel) => {
      const validChannels = ['message-from-main', 'state', 'api-key', 'log', 'detected-meetings', 'current-window-id', 'recall-buffer'];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
    },
  },
});
