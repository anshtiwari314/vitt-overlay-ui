//import { fileURLToPath } from 'url';
//const WebSocket = require('ws');

import {fileURLToPath} from 'url'
import axios from 'axios';
import dotenv from 'dotenv'
dotenv.config();
dotenv.config({ path: process.resourcesPath + "/app/.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//import path from 'node:path';
import path from 'path'

import { app, BrowserWindow, ipcMain, shell, dialog, Notification,globalShortcut, nativeTheme, screen,Menu,Tray } from 'electron';
import RecallAiSdk from '@recallai/desktop-sdk';



let win;
let isClickThrough = true;
let tray;

let detectedMeeting = null
let currentProvider = 'deepgram';
let state = {
  recording: false,
  permissions_granted: true,
  meetings: [],
};
let counter = 0

//console.log('env',process.env.RECALLAI_API_URL,process.env.RECALLAI_API_KEY)

function sendState() {
  //console.log('sendState triggeres')
  try {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send('state', state);
    }
  } catch (e) {
    console.error("Failed to send message to renderer:", e);
  }
}

function getFormattedDate() {
  const now = new Date();

  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);

  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours %= 12;
  hours ||= 12;
  const formattedHours = String(hours).padStart(2, '0');

  return `${month}-${day}-${year} ${formattedHours}:${minutes} ${ampm}`;
}
async function createDesktopSdkUpload() {
  const url = `${process.env.RECALLAI_API_URL}/api/v1/sdk-upload/`;

  let recording_config = {};
  if (currentProvider === 'deepgram') {
    recording_config = {
      "transcript": {
        "provider": {
          "deepgram_streaming": {
            // "model": "nova-2",
            // "language": "en",
            // "punctuate": true,
            // "smart_format": true,
            // "diarize": true
          }
        }
      },
      "realtime_endpoints": [
        {
          "type": "desktop_sdk_callback",
          "events": [
            //"transcript.partial_data",
            "transcript.data"
          ]
        }
      ]
    };
  } else if (currentProvider === 'assemblyai') {
    recording_config = {
      "transcript": {
        "provider": {
          "assembly_ai_v3_streaming": {
            // any additional AssemblyAI real-time params
          }
        }
      },
      "realtime_endpoints": [
        {
          "type": "desktop_sdk_callback",
          "events": ["transcript.data"]
        }
      ]
    };
  }

  const response = await axios.post(url, {
    recording_config,
}, {
    headers: { 'Authorization': `Token ${process.env.RECALLAI_API_KEY}` },

    timeout: 3000,
  });

  return response.data;
}
async function startRecording(windowId) {
  console.log("recording started", windowId);

  try {
    const { upload_token } = await createDesktopSdkUpload();

    if (!upload_token) {
      throw new Error("No upload token received from the server.");
    }

    RecallAiSdk.startRecording({
      windowId: windowId,
      uploadToken: upload_token
    });

    await RecallAiSdk.requestPermission("accessibility");
    await RecallAiSdk.requestPermission("microphone system-audio");
    await RecallAiSdk.requestPermission("system-audio");
    //await RecallAiSdk.requestPermission("screen-capture");

    console.log("Permissions requested");

    win.webContents.send('current-window-id', windowId);
  } catch (error) {
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
    }
    console.error("Error in startRecording:", error.message);


    dialog.showErrorBox(
      "Recording Error",
      `Failed to start recording:\n${error.message}`
    );

    if (process.platform === "darwin") app.dock.bounce('critical');
  }
}



function createWindow () {
  const width = 380;
  //const height = 550;
  const height = 600;

  win = new BrowserWindow({
    width,
    height,
    
    frame: false,
    transparent: true,
    //backgroundColor: '#2e2c29',
    backgroundColor: '#00000000',
    hasShadow: true,
    alwaysOnTop: false,
    resizable: true,
    skipTaskbar: false,
    //accentColor:'#FF0000',
    fullscreenable: false,
    movable:true,
    webPreferences: {
      // nodeIntegration: true,
      // contextIsolation: true,
      // sandbox: true,
      preload: __dirname + '/preload.js',
      sandbox:false,
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: false,
      accessibilitySupport: true
    }
  });

  try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (e) {}

  //win.setIgnoreMouseEvents(true, { forward: true });
  //win.loadFile('index.html');
  win.loadURL('http://localhost:5173');
  win.webContents.openDevTools()

  // win.webContents.on('did-finish-load', () => {
  //   console.log("Renderer finished loading");

  //   setInterval(() => {
  //     console.log("Sending something-happened", counter);
  //     win.webContents.send("something-happened", counter++);
  //   }, 3000);
  // });



  const primary = screen.getPrimaryDisplay().workArea;
  const x = Math.round(primary.x + (primary.width - width) / 2);
  const y = Math.round(primary.y + (primary.height - height) / 2 - 40);
  win.setPosition(x, y);

  nativeTheme.themeSource = 'dark';

  console.log('=== Initial state:', state);
}

function toggleClickThrough() {
  isClickThrough = !isClickThrough;
  if (win) {
    win.setIgnoreMouseEvents(isClickThrough, { forward: true });
    win.webContents.send('overlay:clickThrough', isClickThrough);
  }
}

function toggleOverlayVisibility() {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else win.showInactive();
}

const menuTemplate = [
  // ... (other menu items)
  {
    label: 'View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click(item, focusedWindow) {
          if (focusedWindow) focusedWindow.reload();
        },
      },
      // ... (other view menu items)
    ],
  },
];

function showWindow() {
  if (BrowserWindow.getAllWindows().length <= 1)
    createWindow();
  else
    win.show();
}

function createTray() {
  // Use a relative path to your icon file (e.g., in a 'resources' folder)
  const iconPath = path.join(__dirname, 'vitt-logo.png'); 
  
  // NOTE: For Windows, a .ico file is often preferred for Tray.
  tray = new Tray(iconPath);

  tray.setToolTip('My Electron App');
  
  // Create a context menu for the tray icon
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => win.show() },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // Optional: Handle single-click to show/hide the window
  tray.on('click', () => {
      win.isVisible() ? win.hide() : win.show();
  });
}


const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);






app.whenReady().then(() => {
  createWindow();
  createTray();



  globalShortcut.register('Alt+`', toggleClickThrough);
  globalShortcut.register('Alt+Shift+H', toggleOverlayVisibility);
  globalShortcut.register('Alt+Shift+R', () => win && win.reload());

  app.on('activate', () => {
    showWindow()
  });

  app.on('window-all-closed', () => {
    // Do nothing. Electron kills the app when all windows are closed unless we
    // subscribe to this event, and macOS applications usually stay open even
    // with all windows closed.
  });


  // setInterval(()=>{
  //   console.log("Sending something-happened", counter);
  //   win.webContents.send("something-happened",counter++)
  // },3000)
  
  console.log('recall',RecallAiSdk);

  RecallAiSdk.addEventListener('permission-status',async  (evt) => {
    const { permission, status } = evt
    console.log(`Permission: ${permission}, Status: ${status}`)
  })

  RecallAiSdk.addEventListener('permissions-granted', async (evt) => {
    console.log("Permissions granted, ready to record");
    state.permissions_granted = true;
    
    setInterval(sendState, 1000);
  });

  RecallAiSdk.addEventListener('meeting-updated', async (evt) => {
    console.log("Meeting updated", evt);
    
  });

  RecallAiSdk.addEventListener('realtime-event', async (evt) => {
    //evt.data.data.buffer = ''
    console.log('realtime event',evt);
    
    win.webContents.send('recall-buffer', evt);
    
    //wsClient.send(JSON.stringify(evt))
    //console.log('realtime',evt)
    //evt.data.data.buffer 
    //evt.data.data.timestamp
    //evt.data.recording :{id,metadata}
    //evt.event
    // evt.window
  });

  RecallAiSdk.addEventListener('media-capture-status', async (evt) => {
    console.log(evt);
  });

  RecallAiSdk.addEventListener('error', async (evt) => {
    let { type, message } = evt;

    if (type === "upload") {
      for (let meeting of state.meetings) {
        if (meeting.id === evt.window.id)
          meeting.status = "failed";
      }

      sendState();

      dialog.showErrorBox('Upload error', `There was an error uploading the recording. Reason: ${message}`);
    } else {
      dialog.showErrorBox("Error", `An error occurred. Reason: ${type} -- ${message}`);
    }

    new Notification({
      title: 'Error',
      body: 'An error occured.',
    }).show();

    if (process.platform === "darwin") app.dock.bounce('critical');

    console.error("ERROR: ", type, message);
  });

  RecallAiSdk.addEventListener('upload-progress', async (evt) => {
    for (let meeting of state.meetings) {
      if (meeting.id === evt.window.id)
        meeting.uploadPercentage = evt.progress;

      if (evt.progress === 100)
        meeting.status = 'completed';
    }

    sendState();
  });

  RecallAiSdk.addEventListener('recording-ended', async (evt) => {
    state.meetings.push({ title: getFormattedDate(), id: evt.window.id, uploadPercentage: 0, status: "in-progress" });
    sendState();

    RecallAiSdk.uploadRecording({ windowId: evt.window.id });
  });

  RecallAiSdk.addEventListener('meeting-closed', async (evt) => {
    console.log("MEETING CLOSED", evt);
    detectedMeeting = null;
  });

  RecallAiSdk.addEventListener('meeting-detected', async (evt) => {
    console.log("MEETING DETECTED", evt);
    detectedMeeting = evt;

    setTimeout(() => {
      if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed())
        win.webContents.send('meeting-detected', evt);
    }, 500);

    let notif = new Notification({
      title: 'Meeting detected',
      body: 'Click here to record the meeting.',
      actions: [
        {
          type: "button",
          text: "Record"
        },
        {
          type: "button",
          text: "Ignore"
        }
      ]
    });

    notif.on('action', async (_action, index) => {
      if (index === 0)
        await startRecording(evt.window.id);
    });

    notif.on('click', async () => {
      await startRecording(evt.window.id);
    });

    notif.show();
  });

  RecallAiSdk.addEventListener('sdk-state-change', (event) => {
    try {
      switch (event.sdk.state.code) {
        case 'recording':
          if (process.platform === "darwin") app.dock.setBadge('Recording');
          console.log('=== Recording started:', event);
          state.recording = true;
          sendState();
          break;
        case 'idle':
          if (process.platform === "darwin") app.dock.setBadge("");
          console.log('=== Recording idle:', event);
          state.recording = false;
          sendState();
          break;
        case 'paused':
          if (process.platform === "darwin") app.dock.setBadge("Paused");
          console.log('=== Recording paused:', event);
          state.recording = false;
          sendState();
          break;
      }
    } catch (e) {
      console.error(e);
    }
  });
  
  RecallAiSdk.init({
    api_url: process.env.RECALLAI_API_URL,
    acquirePermissionsOnStartup: ["microphone", "accessibility", "system-audio"],
    config: {},
    restartOnError: true
  });


  

  ipcMain.on('close-app', () => {
    //console.log('app is now closed');
    app.quit();
});
  ipcMain.on('minimize-app', () => {
    if (win) win.minimize();
  });
  ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
  });
  ipcMain.on('message-from-renderer', async (event, arg) => {
    console.log('message-from-renderer', arg);
    switch (arg.command) {
      case 'renderer-ready':
        console.log('Renderer is ready, sending initial state');
        sendState();
        break;
      case 'reupload':
        RecallAiSdk.uploadRecording({ windowId: arg.id });
        break;
      case 'start-recording':
        if (!detectedMeeting) {
          dialog.showMessageBoxSync(null, { message: "There is no meeting in progress." });
          break;
        }
        await startRecording(detectedMeeting.window.id);
        break;
      case 'stop-recording':
        RecallAiSdk.stopRecording({ windowId: detectedMeeting.window.id });
        break;
      case 'change-provider':
        currentProvider = arg.provider;
        console.log(`Provider changed to ${currentProvider}`);
        if (state.recording && detectedMeeting) {
             console.log("Restarting recording to apply provider change...");
             RecallAiSdk.stopRecording({ windowId: detectedMeeting.window.id });
             setTimeout(async () => {
                await startRecording(detectedMeeting.window.id);
             }, 2000);
        }
        break;
    }
  });

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
