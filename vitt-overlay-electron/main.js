import { app, BrowserWindow, ipcMain, shell, globalShortcut, nativeTheme, screen, Menu, Tray } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win;
let tray;
let isClickThrough = true;

function createWindow() {
  const width = 380;
  const height = 600;

  win = new BrowserWindow({
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    alwaysOnTop: true,
    resizable: false,
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
    try {
      win.setAlwaysOnTop(false);
    } catch (_e) {}
  });
  win.on('restore', () => {
    try {
      win.setAlwaysOnTop(true, 'screen-saver');
    } catch (_e) {}
  });
  win.on('show', () => {
    try {
      if (!win.isMinimized()) win.setAlwaysOnTop(true, 'screen-saver');
    } catch (_e) {}
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
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

const menuTemplate = [
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

  ipcMain.on('close-app', () => {
    app.quit();
  });

  ipcMain.on('minimize-app', () => {
    if (win) win.minimize();
  });

  ipcMain.on('open-external', (_event, url) => {
    shell.openExternal(url);
  });

  ipcMain.on('message-from-renderer', (_event, arg) => {
    if (!arg || !arg.command) return;
    if (arg.command === 'renderer-ready') {
      // Keep compatibility with renderer IPC path.
      if (win && !win.isDestroyed()) {
        win.webContents.send('state', {
          recording: false,
          permissions_granted: true,
          meetings: []
        });
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
