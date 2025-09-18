const { app, BrowserWindow, globalShortcut, nativeTheme, screen,Menu } = require('electron');
let win;
let isClickThrough = true;

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
      nodeIntegration: true,
      contextIsolation: true,
      sandbox: true,
      preload: __dirname + '/preload.js'
    }
  });

  try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (e) {}

  //win.setIgnoreMouseEvents(true, { forward: true });
  //win.loadFile('index.html');
  win.loadURL('http://localhost:5173');

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

const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);


app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('Alt+`', toggleClickThrough);
  globalShortcut.register('Alt+Shift+H', toggleOverlayVisibility);
  globalShortcut.register('Alt+Shift+R', () => win && win.reload());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
