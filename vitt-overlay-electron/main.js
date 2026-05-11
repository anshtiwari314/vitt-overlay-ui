import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '.env'),
  path.join(process.resourcesPath, '.env'),
  path.join(process.resourcesPath, 'app', '.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('Loaded environment from:', envPath);
    break;
  }
}

import { app, BrowserWindow, ipcMain, shell, dialog, Notification, globalShortcut, nativeTheme, screen, Menu, Tray } from 'electron';
import RecallAiSdk from '@recallai/desktop-sdk';

let win;
let tray;
let isClickThrough = true;

let detectedMeeting = null;
let state = {
  recording: false,
  permissions_granted: true,
  meetings: [],
};

function sendState() {
  try {
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send('state', state);
    }
  } catch (e) {
    console.error('Failed to send message to renderer:', e);
  }
}

function revealWindow() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
  try {
    win.flashFrame(true);
    setTimeout(() => {
      if (win && !win.isDestroyed()) win.flashFrame(false);
    }, 3000);
  } catch (e) {}
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
    recording_config: {
      video_mixed_mp4: null,
      audio_mixed_mp3: {},
      realtime_endpoints: [
        {
          type: 'desktop_sdk_callback',
          events: ['audio_mixed_raw.data']
        },
      ],
    }
  }, {
    headers: { 'Authorization': `Token ${process.env.RECALLAI_API_KEY}` },
    timeout: 3000,
  });

  return response.data;
}

async function startRecording(windowId) {
  console.log('recording started', windowId);

  try {
    const { upload_token } = await createDesktopSdkUpload();

    if (!upload_token) {
      throw new Error('No upload token received from the server.');
    }

    RecallAiSdk.startRecording({
      windowId: windowId,
      uploadToken: upload_token
    });

    await RecallAiSdk.requestPermission('accessibility');
    await RecallAiSdk.requestPermission('microphone system-audio');
    await RecallAiSdk.requestPermission('system-audio');

    console.log('Permissions requested');

    if (win && !win.isDestroyed()) {
      win.webContents.send('current-window-id', windowId);
    }
  } catch (error) {
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    console.error('Error in startRecording:', error.message);

    dialog.showErrorBox(
      'Recording Error',
      `Failed to start recording:\n${error.message}`
    );

    if (process.platform === 'darwin') app.dock.bounce('critical');
  }
}

function createWindow() {
  const width = 280;
  const height = 380;

  win = new BrowserWindow({
    width,
    height,
    minWidth: 380,
    minHeight: 600,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    alwaysOnTop: true,
    resizable: true,
    maximizable: false,
    skipTaskbar: false,
    fullscreenable: false,
    movable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: false,
      accessibilitySupport: true
    }
  });

  try {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch (_e) {}
  try {
    win.setAlwaysOnTop(true, 'screen-saver');
  } catch (_e) {}
  win.on('minimize', () => {
    try { win.setAlwaysOnTop(false); } catch (_e) {}
  });
  win.on('restore', () => {
    try { win.setAlwaysOnTop(true, 'screen-saver'); } catch (_e) {}
  });
  win.on('resize', () => {
    try {
      if (win && !win.isDestroyed()) {
        const { width, height } = win.getBounds();
        win.webContents.send('window-resized', { width, height });
      }
    } catch (_e) {}
  });
  win.on('show', () => {
    try {
      if (!win.isMinimized()) win.setAlwaysOnTop(true, 'screen-saver');
    } catch (_e) {}
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5174');
  } else {
    const clientDistIndex = path.join(process.resourcesPath, 'client-dist', 'index.html');
    win.loadFile(clientDistIndex);
  }

  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }

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

function showWindow() {
  if (BrowserWindow.getAllWindows().length <= 1) createWindow();
  else win.show();
}

function createTray() {
  let iconPath;
  if (app.isPackaged) iconPath = path.join(process.resourcesPath, 'build', 'vitt-logo.png');
  else iconPath = path.join(__dirname, 'build', 'vitt-logo.png');

  try {
    tray = new Tray(iconPath);
  } catch (e) {
    console.error('Failed to create tray icon', iconPath, e);
    return;
  }

  tray.setToolTip('Vitt Overlay');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => win && win.show() },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (!win) return;
    win.isVisible() ? win.hide() : win.show();
  });
}

const isMac = process.platform === 'darwin';

const menuTemplate = [
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }
      ]
    : []),
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      ...(isMac
        ? [
            { role: 'pasteAndMatchStyle' },
            { role: 'delete' },
            { role: 'selectAll' }
          ]
        : [
            { role: 'delete' },
            { type: 'separator' },
            { role: 'selectAll' }
          ])
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click(item, focusedWindow) {
          if (focusedWindow) focusedWindow.reload();
        }
      }
    ]
  }
];

app.setAppUserModelId('com.VittAi.overlay');

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  createWindow();
  createTray();

  globalShortcut.register('Alt+`', toggleClickThrough);
  globalShortcut.register('Alt+Shift+H', toggleOverlayVisibility);
  globalShortcut.register('Alt+Shift+R', () => win && win.reload());

  app.on('activate', () => {
    showWindow();
  });

  app.on('window-all-closed', () => {
    // Keep app alive like standard tray apps.
  });

  console.log('recall', RecallAiSdk);

  RecallAiSdk.addEventListener('permission-status', async (evt) => {
    const { permission, status } = evt;
    console.log(`Permission: ${permission}, Status: ${status}`);
  });

  RecallAiSdk.addEventListener('permissions-granted', async () => {
    console.log('Permissions granted, ready to record');
    state.permissions_granted = true;
    setInterval(sendState, 1000);
  });

  RecallAiSdk.addEventListener('meeting-updated', async (evt) => {
    console.log('Meeting updated', evt);
  });

  RecallAiSdk.addEventListener('realtime-event', async (evt) => {
    console.log('realtime event', evt);
    if (win && !win.isDestroyed()) {
      win.webContents.send('recall-buffer', evt);
    }
  });

  RecallAiSdk.addEventListener('media-capture-status', async (evt) => {
    console.log(evt);
  });

  RecallAiSdk.addEventListener('error', async (evt) => {
    const { type, message } = evt;

    if (type === 'upload') {
      for (const meeting of state.meetings) {
        if (meeting.id === evt.window.id) meeting.status = 'failed';
      }
      sendState();
      dialog.showErrorBox('Upload error', `There was an error uploading the recording. Reason: ${message}`);
    } else {
      dialog.showErrorBox('Error', `An error occurred. Reason: ${type} -- ${message}`);
    }

    new Notification({
      title: 'Error',
      body: 'An error occured.',
    }).show();

    revealWindow();

    if (process.platform === 'darwin') app.dock.bounce('critical');

    console.error('ERROR: ', type, message);
  });

  RecallAiSdk.addEventListener('upload-progress', async (evt) => {
    for (const meeting of state.meetings) {
      if (meeting.id === evt.window.id) meeting.uploadPercentage = evt.progress;
      if (evt.progress === 100) meeting.status = 'completed';
    }
    sendState();
  });

  RecallAiSdk.addEventListener('recording-ended', async (evt) => {
    state.meetings.push({ title: getFormattedDate(), id: evt.window.id, uploadPercentage: 0, status: 'in-progress' });
    sendState();
    RecallAiSdk.uploadRecording({ windowId: evt.window.id });
  });

  RecallAiSdk.addEventListener('meeting-closed', async (evt) => {
    console.log('MEETING CLOSED', evt);
    detectedMeeting = null;
    if (win && !win.isDestroyed()) {
      win.webContents.send('meeting-closed', evt);
    }
  });

  RecallAiSdk.addEventListener('meeting-detected', async (evt) => {
    console.log('MEETING DETECTED', evt);
    detectedMeeting = evt;

    setTimeout(() => {
      if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send('meeting-detected', evt);
      }
    }, 500);

    const notif = new Notification({
      title: 'Meeting detected',
      body: 'Click here to record the meeting.',
      actions: [
        { type: 'button', text: 'Record' },
        { type: 'button', text: 'Ignore' }
      ]
    });

    notif.on('action', async (_action, index) => {
      if (index === 0) await startRecording(evt.window.id);
    });

    notif.on('click', async () => {
      await startRecording(evt.window.id);
    });

    notif.show();
    revealWindow();
  });

  RecallAiSdk.addEventListener('sdk-state-change', (event) => {
    try {
      switch (event.sdk.state.code) {
        case 'recording':
          if (process.platform === 'darwin') app.dock.setBadge('Recording');
          console.log('=== Recording started:', event);
          state.recording = true;
          sendState();
          break;
        case 'idle':
          if (process.platform === 'darwin') app.dock.setBadge('');
          console.log('=== Recording idle:', event);
          state.recording = false;
          sendState();
          break;
        case 'paused':
          if (process.platform === 'darwin') app.dock.setBadge('Paused');
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
    acquirePermissionsOnStartup: ['microphone', 'accessibility', 'system-audio'],
    config: {},
    restartOnError: true
  });

  ipcMain.on('close-app', () => {
    app.quit();
  });

  ipcMain.on('minimize-app', () => {
    if (win) win.minimize();
  });

  ipcMain.on('open-external', (_event, url) => {
    shell.openExternal(url);
  });

  // --- Window resize & emulated fullscreen ---
  // The overlay window is created with frame:false, transparent:true and
  // fullscreenable:false, so OS-level fullscreen is blocked. We emulate it by
  // resizing the window to fill the display work area, and remember the prior
  // bounds so toggling restores them.
  let preFullscreenBounds = null;

  ipcMain.on('resize-window', (_event, payload) => {
    try {
      if (!win) return;
      const { widthPct, heightPct, width, height } = payload || {};
      const display = screen.getDisplayMatching(win.getBounds()) || screen.getPrimaryDisplay();
      const { x: ax, y: ay, width: aw, height: ah } = display.workArea;

      let w, h;
      if (typeof width === 'number' && typeof height === 'number') {
        w = width;
        h = height;
      } else if (typeof widthPct === 'number' && typeof heightPct === 'number') {
        w = Math.round(aw * widthPct);
        h = Math.round(ah * heightPct);
      } else {
        return;
      }

      const x = Math.round(ax + (aw - w) / 2);
      const y = Math.round(ay + (ah - h) / 2);
      win.setBounds({ x, y, width: w, height: h });
      preFullscreenBounds = null;
    } catch (e) {
      console.error('ipcMain: resize-window error', e);
    }
  });

  ipcMain.on('toggle-fullscreen', () => {
    try {
      if (!win) return;
      const display = screen.getDisplayMatching(win.getBounds()) || screen.getPrimaryDisplay();
      const wa = display.workArea;
      const cur = win.getBounds();
      const isFull =
        preFullscreenBounds != null &&
        cur.x === wa.x && cur.y === wa.y && cur.width === wa.width && cur.height === wa.height;
      if (isFull) {
        win.setBounds(preFullscreenBounds);
        preFullscreenBounds = null;
      } else {
        preFullscreenBounds = cur;
        win.setBounds({ x: wa.x, y: wa.y, width: wa.width, height: wa.height });
      }
    } catch (e) {
      console.error('ipcMain: toggle-fullscreen error', e);
    }
  });

  ipcMain.handle('get-window-size', () => {
    if (!win) return null;
    const { width, height } = win.getBounds();
    return { width, height };
  });

  ipcMain.on('message-from-renderer', async (_event, arg) => {
    console.log('message-from-renderer', arg);
    if (!arg || !arg.command) return;
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
          dialog.showMessageBoxSync(null, { message: 'There is no meeting in progress.' });
          break;
        }
        await startRecording(detectedMeeting.window.id);
        break;
      case 'stop-recording':
        if (detectedMeeting) {
          RecallAiSdk.stopRecording({ windowId: detectedMeeting.window.id });
        }
        break;
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
