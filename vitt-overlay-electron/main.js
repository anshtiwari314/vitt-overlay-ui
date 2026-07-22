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
  sendExtensionCommand,
  setExtensionBridgeListener,
  setExtensionConnectionChangeListener,
  getExtensionBridgeUrl,
  getExtensionConnected
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
let isClickThrough = false;

/** Active detected meetings. Source of truth for renderer UI. */
let detectedMeetings = [];

/** SDK/recording state forwarded to the renderer. */
let state = {
  bot_id: null,
  recording: false,
  transcript: null,
  video_url: null,
  permissions_granted: true,
  meetings: []
};

function registerIpcHandlers() {
  ipcMain.on('close-app', () => {
    app.quit();
  });

  ipcMain.on('minimize-app', () => {
    if (win) win.minimize();
  });

  ipcMain.on('overlay-set-mouse-ignore', (_event, ignore) => {
    if (!win) return;
    if (!isClickThrough) {
      applyMousePassthrough(false);
      return;
    }
    applyMousePassthrough(Boolean(ignore));
  });

  ipcMain.on('open-external', (_event, url) => {
    shell.openExternal(url);
  });

  // --- Window resize & emulated fullscreen ---
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

  ipcMain.handle('launch-browser-extension', async (_event, url) => {
    try {
      const result = await launchChromeWithExtension({ url: typeof url === 'string' ? url : undefined });
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
    console.log(`[scrape] react → electron: job ${job.jobId} ${job.url}`);
    enqueueExtensionJob(job);
    return { ok: true };
  });

  ipcMain.handle('get-extension-bridge-url', () => getExtensionBridgeUrl());

  ipcMain.handle('get-extension-bridge-status', () => ({
    connected: getExtensionConnected()
  }));

  ipcMain.handle('extension-send-command', (_event, payload) => {
    return sendExtensionCommand(payload);
  });

  ipcMain.handle('get-extension-path', () => ({
    path: getExtensionPath(),
    exists: fs.existsSync(path.join(getExtensionPath(), 'manifest.json'))
  }));

  ipcMain.handle('reveal-extension-folder', () => {
    const extensionPath = getExtensionPath();
    if (!fs.existsSync(extensionPath)) {
      return { ok: false, error: `Extension folder not found: ${extensionPath}` };
    }
    shell.showItemInFolder(path.join(extensionPath, 'manifest.json'));
    return { ok: true, path: extensionPath };
  });

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
        pushExtensionBridgeStatusToRenderer();
        break;
      case 'reupload':
      case 'start-recording':
      case 'stop-recording':
        break;
    }
  });
}

function sendScrapeBridgeEvent(payload) {
  try {
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send('scrape-bridge-event', payload);
    }
  } catch (e) {
    console.error('sendScrapeBridgeEvent', e);
  }
}

function pushExtensionBridgeStatusToRenderer() {
  try {
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.send('extension-bridge-status', { connected: getExtensionConnected() });
  } catch (e) {
    console.error('pushExtensionBridgeStatusToRenderer', e);
  }
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

  applyMousePassthrough(isClickThrough);

  console.log('=== Initial state:', state);
}

function applyMousePassthrough(ignore) {
  if (!win) return;
  try {
    win.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
  } catch (e) {
    console.error('applyMousePassthrough', e);
  }
}

function toggleClickThrough() {
  isClickThrough = !isClickThrough;
  if (win) {
    applyMousePassthrough(isClickThrough);
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

  registerIpcHandlers();

  startExtensionBridge();
  setExtensionConnectionChangeListener(() => {
    pushExtensionBridgeStatusToRenderer();
  });
  setExtensionBridgeListener((payload) => {
    if (payload.type === 'scrape_result') {
      const via = payload.source === 'extension-popup' ? 'manual popup' : 'automated';
      const pkg = payload.capture?.listingPackages?.[0];
      console.log(`[scrape] extension → electron: result (${via}) ${payload.jobId}`);
      console.log('[vitt-dev] result', {
        jobId: payload.jobId,
        pageType: payload.capture?.pageType ?? payload.pageType,
        itineraryId: payload.capture?.pageType === 'mmt-diy-planner' ? payload.capture?.itineraryId : undefined,
        packageName: pkg?.name,
        detail_url: pkg?.detail_url?.slice(0, 80),
        outcome: payload.capture?.devLog?.outcome,
        type4DurationMs: payload.capture?.pageType === 'mmt-package' ? payload.capture?.devLog?.durationMs : undefined,
        type4Sections: payload.capture?.pageType === 'mmt-package' ? Object.keys(payload.capture?.sections || {}) : undefined
      });
    } else if (payload.type === 'job_status') {
      console.log(`[scrape] extension → electron: ${payload.status} ${payload.jobId} — ${payload.message || ''}`);
    } else if (payload.type === 'scrape_error') {
      console.log(`[scrape] extension → electron: error ${payload.jobId} ${payload.error}`);
    }
    sendScrapeBridgeEvent(payload);
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
