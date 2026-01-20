const { contextBridge, ipcRenderer } = require('electron');

console.log("Preload loaded");

contextBridge.exposeInMainWorld('overlay', {
  onClickThrough: (cb) => ipcRenderer.on('overlay:clickThrough', (_e, val) => cb(val)),
  somethingHappened:(cb)=> ipcRenderer.on('something-happened',(_e,data)=>cb(data)),
  getRecallBuffer:(cb)=> {
    const subscription = (_event, data) => cb(data);
    //console.log("Subscribed to recall-buffer",data);
    //(_e,data)=>cb(data)
    ipcRenderer.on('recall-buffer',subscription)
    
    return () => ipcRenderer.removeListener('recall-buffer', subscription);
  },
  quitApp: () => ipcRenderer.send('close-app')
});

contextBridge.exposeInMainWorld('electronAPI',{
   ipcRenderer: {
    send: (channel, data) => {
      // Whitelist channels
      const validChannels = ['message-from-renderer', 'api-key', 'log'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    on: (channel, func) => {
      const validChannels = ['message-from-main', 'state', 'api-key', 'log'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    removeAllListeners: (channel) => {
      const validChannels = ['message-from-main', 'state', 'api-key', 'log'];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
    },
  },
})
