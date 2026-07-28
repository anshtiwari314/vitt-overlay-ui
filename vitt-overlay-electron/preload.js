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
  setMousePassthrough: (ignore) => ipcRenderer.send('overlay-set-mouse-ignore', ignore),
  startWindowDrag: () => ipcRenderer.send('overlay-window-drag-start'),
  moveWindowDrag: () => ipcRenderer.send('overlay-window-drag-move'),
  stopWindowDrag: () => ipcRenderer.send('overlay-window-drag-stop'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  resizeWindow: (payload) => ipcRenderer.send('resize-window', payload),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  getWindowSize: () => ipcRenderer.invoke('get-window-size'),
  onWindowResized: (cb) => {
    const subscription = (_event, data) => cb(data);
    ipcRenderer.on('window-resized', subscription);
    return () => ipcRenderer.removeListener('window-resized', subscription);
  },
  launchBrowserExtension: (url) => ipcRenderer.invoke('launch-browser-extension', url),
  getScrapeServerInfo: () => ipcRenderer.invoke('get-scrape-server-info'),
  scrapeStart: (job) => ipcRenderer.invoke('scrape-start', job),
  getExtensionBridgeUrl: () => ipcRenderer.invoke('get-extension-bridge-url'),
  getExtensionBridgeStatus: () => ipcRenderer.invoke('get-extension-bridge-status'),
  onExtensionBridgeStatus: (cb) => {
    const subscription = (_event, data) => cb(data);
    ipcRenderer.on('extension-bridge-status', subscription);
    return () => ipcRenderer.removeListener('extension-bridge-status', subscription);
  },
  sendExtensionCommand: (payload) => ipcRenderer.invoke('extension-send-command', payload),
  getExtensionPath: () => ipcRenderer.invoke('get-extension-path'),
  revealExtensionFolder: () => ipcRenderer.invoke('reveal-extension-folder'),
  onScrapeBridgeEvent: (cb) => {
    const subscription = (_event, data) => cb(data);
    ipcRenderer.on('scrape-bridge-event', subscription);
    return () => ipcRenderer.removeListener('scrape-bridge-event', subscription);
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
