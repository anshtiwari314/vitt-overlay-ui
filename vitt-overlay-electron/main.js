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
let state = {
  recording: false,
  permissions_granted: true,
  meetings: [],
};
let counter = 0

console.log('env',process.env.RECALLAI_API_URL,process.env.RECALLAI_API_KEY)

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

  const response = await axios.post(url, {

  // recording_config: {
  //   "transcript": {
  //     "provider": {
  //       "recallai_streaming": {}
  //     },
  //     "diarization": {
  //       "use_separate_streams_when_available": false
  //     }
  //   },
  //   "realtime_endpoints": [
  //     {
  //       "type": "webhook",
  //       "url": "https://2af348a85290.ngrok-free.app/get-data",
  //       "events": ["transcript.data", "transcript.partial_data"]
  //     }
  //   ]
  // }

  // recording_config: {
  //   "audio_separate_raw": {}, 
  //   "realtime_endpoints": [
  //     {
  //     	type: "websocket", 
  //       url:  "wss://2af348a85290.ngrok-free.app",
  //       events: ["audio_separate_raw.data"]
  //     }
  //   ]
  // }
  
    "recording_config": {
    // user_data: {
    //         projectId: "ABC-123",
    //         userId: "USER-987",
    //         customTag: "production-meeting"
    //     },
    realtime_endpoints: [
    {
      //type: "desktop_sdk_callback",
      type: "websocket",
      url:'wss://b974ed4543d5.ngrok-free.app',
      events: ["audio_mixed_raw.data"]
      //events: ["audio_participant_raw.data"]
    },
  ],
  }

  // "recording_config": {
  //   "transcript": {
  //     "provider": {
  //       //"recallai_streaming": {}
  //       "deepgram_streaming": {}
  //     }
  //   },
  //   "realtime_endpoints": [
  //     {
  //       "type": "websocket",
  //       "url": "wss://c93e54c5614f.ngrok-free.app/",
  //       "events": ["transcript.data"]
  //     }
  //   ]
  // }
}, {
    headers: { 'Authorization': `Token ${process.env.RECALLAI_API_KEY}` },

    timeout: 3000,
  });

  return response.data;
}
async function startRecording(windowId) {
  try {
    const { upload_token } = await createDesktopSdkUpload();

    if (!upload_token) {
      throw new Error("No upload token received from the server.");
    }

    RecallAiSdk.startRecording({
      windowId: windowId,
      uploadToken: upload_token
    });
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
  const width = 420;
  const height = 520;

  win = new BrowserWindow({
    width,
    height,
    
    frame: false,
    transparent: true,

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
  
  console.log('recall',RecallAiSdk)

  RecallAiSdk.addEventListener('permissions-granted', async (evt) => {
    console.log("Permissions granted, ready to record");
    state.permissions_granted = true;
    
    setInterval(sendState, 1000);
  });

  RecallAiSdk.addEventListener('meeting-updated', async (evt) => {
    console.log("Meeting updated", evt);
    
  });

  RecallAiSdk.addEventListener('realtime-event', async (evt) => {
    //console.log('realtime event',evt);
    //wsClient.send(JSON.stringify(evt))
    console.log(evt)
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
    acquirePermissionsOnStartup: ["microphone", "accessibility", "screen-capture"],
    config: {}
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
    }
  });

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
