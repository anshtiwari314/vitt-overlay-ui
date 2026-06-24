import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const portableExeDir = process.env.PORTABLE_EXECUTABLE_DIR;
const envCandidates = [
  ...(portableExeDir ? [path.join(portableExeDir, '.env')] : []),
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

import { app, BrowserWindow, ipcMain, shell, globalShortcut, nativeTheme, screen, Menu, Tray } from 'electron';
import contextMenu from 'electron-context-menu';
import { launchChromeWithExtension, getExtensionPath } from './browserCapture.js';
import {
  startExtensionBridge,
  enqueueExtensionJob,
  setExtensionBridgeListener,
  getExtensionBridgeUrl,
  isExtensionBridgeConnected
} from './extensionBridge.js';

// Right-click context menu (cut/copy/paste/select-all) for any editable
// field in any renderer. Without this, macOS users cannot right-click→Paste
// into inputs such as the WebSocket URL field on the login screen.
contextMenu({
  showCopyImage: false,
  showSearchWithGoogle: false,
  showInspectElement: !app.isPackaged,
  showLearnSpelling: false,
  showLookUpSelection: false,
  showServices: false
});

let win;
let tray;
let isClickThrough = true;

/** Active detected meetings. Source of truth for renderer UI. */
let detectedMeetings = [];

function sendScrapeBridgeEvent(payload) {
  try {
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send('scrape-bridge-event', payload);
    }
  } catch (e) {
    console.error('sendScrapeBridgeEvent', e);
  }
}

function notifyExtensionStatus() {
  sendScrapeBridgeEvent({
    type: 'extension_status',
    connected: isExtensionBridgeConnected()
  });
}

function sendDetectedMeetingsState() {
  try {
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send('detected-meetings', { meetings: detectedMeetings });
    }
  } catch (e) {
    console.error('Failed to send detected meetings to renderer:', e);
  }
}

function sendState() {
  try {
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send('state', state);
    }
  } catch (e) {
    console.error('Failed to send message to renderer:', e);
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
  const iconPath = path.join(__dirname, 'build', 'vitt-logo.png');

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

  startExtensionBridge();
  setExtensionBridgeListener((payload) => {
    sendScrapeBridgeEvent(payload);
    if (payload.type === 'extension_status' || payload.type === 'job_status') {
      notifyExtensionStatus();
    }
  });

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

  ipcMain.handle('launch-browser-extension', (_event, url) => {
    try {
      const result = launchChromeWithExtension({ url: typeof url === 'string' ? url : undefined });
      return { ok: true, ...result, bridgeUrl: getExtensionBridgeUrl() };
    } catch (e) {
      console.error('launch-browser-extension', e);
      return { ok: false, error: e.message || String(e) };
    }
  });

  ipcMain.handle('scrape-start', (_event, job) => {
    if (!job?.jobId || !job?.url) {
      return { ok: false, error: 'Invalid scrape job' };
    }
    enqueueExtensionJob(job);
    notifyExtensionStatus();
    return { ok: true };
  });

  ipcMain.handle('get-extension-bridge-url', () => getExtensionBridgeUrl());

  ipcMain.handle('get-scrape-server-info', () => ({
    httpBase: process.env.VITT_PORT ? `http://127.0.0.1:${process.env.VITT_PORT}` : 'http://127.0.0.1:5000',
    wsUrl: process.env.VITT_PORT ? `ws://127.0.0.1:${process.env.VITT_PORT}/ws` : 'ws://127.0.0.1:5000/ws',
    extensionPath: getExtensionPath(),
    bridgeUrl: getExtensionBridgeUrl()
  }));

  ipcMain.on('message-from-renderer', async (_event, arg) => {
    console.log('message-from-renderer', arg);
    if (!arg || !arg.command) return;
    switch (arg.command) {
      case 'renderer-ready':
        console.log('Renderer is ready, sending initial state');
        sendState();
        sendDetectedMeetingsState();
        break;
      case 'reupload':
      case 'start-recording':
      case 'stop-recording':
        break;
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
