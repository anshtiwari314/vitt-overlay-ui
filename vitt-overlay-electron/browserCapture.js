import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WIN_CHROME_CANDIDATES = [
  path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
];

const LINUX_CHROME_NAMES = ['google-chrome-stable', 'google-chrome', 'chromium-browser', 'chromium'];

const LINUX_CHROME_PATHS = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium'
];

const MAC_CHROME_APPS = [
  { label: 'Google Chrome', binary: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
  { label: 'Google Chrome Canary', binary: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary' },
  { label: 'Chromium', binary: '/Applications/Chromium.app/Contents/MacOS/Chromium' },
  {
    label: 'Google Chrome',
    binary: path.join(process.env.HOME || '', 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  }
];

function fileExists(filePath) {
  return Boolean(filePath && fs.existsSync(filePath));
}

function readWindowsRegistryChrome() {
  if (process.platform !== 'win32') return null;
  const keys = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe'
  ];
  for (const key of keys) {
    try {
      const output = execSync(`reg query "${key}" /ve`, { encoding: 'utf8', windowsHide: true });
      const match = output.match(/REG_SZ\s+(\S.+)/i);
      const exe = match?.[1]?.trim().replace(/^"(.*)"$/, '$1');
      if (fileExists(exe)) return exe;
    } catch {
      /* try next key */
    }
  }
  return null;
}

function whichExecutable(name) {
  try {
    const cmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const line = output.split(/\r?\n/).find(Boolean);
    if (line && fileExists(line.trim())) return line.trim();
  } catch {
    /* not on PATH */
  }
  return null;
}

function findChromeOnWindows() {
  if (process.env.VITT_CHROME_PATH && fileExists(process.env.VITT_CHROME_PATH)) {
    return process.env.VITT_CHROME_PATH;
  }
  const fromRegistry = readWindowsRegistryChrome();
  if (fromRegistry) return fromRegistry;
  return WIN_CHROME_CANDIDATES.find(fileExists) || null;
}

function findChromeOnLinux() {
  if (process.env.VITT_CHROME_PATH && fileExists(process.env.VITT_CHROME_PATH)) {
    return process.env.VITT_CHROME_PATH;
  }
  for (const name of LINUX_CHROME_NAMES) {
    const found = whichExecutable(name);
    if (found) return found;
  }
  return LINUX_CHROME_PATHS.find(fileExists) || null;
}

function findMacChromeApp() {
  if (process.env.VITT_CHROME_PATH && fileExists(process.env.VITT_CHROME_PATH)) {
    return { label: 'Google Chrome', binary: process.env.VITT_CHROME_PATH };
  }
  return MAC_CHROME_APPS.find((app) => fileExists(app.binary)) || null;
}

export function findChromeExecutable() {
  if (process.platform === 'win32') return findChromeOnWindows();
  if (process.platform === 'darwin') return findMacChromeApp()?.binary || null;
  return findChromeOnLinux();
}

export function getExtensionPath() {
  return path.resolve(__dirname, '..', 'page-capture-extension');
}

function spawnDetached(command, args, { shell = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      shell,
      windowsHide: true
    });

    child.once('error', (err) => {
      reject(new Error(`Failed to start Chrome: ${err.message}`));
    });

    child.once('spawn', () => {
      if (!child.pid) {
        reject(new Error('Chrome process failed to start (no PID).'));
        return;
      }
      child.unref();
      resolve({ pid: child.pid, command, args });
    });
  });
}

/**
 * Opens the user's existing default Chrome profile on any OS.
 * Never passes --user-data-dir or --load-extension (no guest profile).
 */
export function launchChromeWithExtension(options = {}) {
  const url = typeof options.url === 'string' && options.url.trim() ? options.url.trim() : null;
  const extensionPath = getExtensionPath();
  const platform = process.platform;

  const finish = (launchInfo) =>
    Promise.resolve({
      ok: true,
      chromePath: launchInfo.command || launchInfo.binary,
      extensionPath,
      pid: launchInfo.pid,
      platform,
      note:
        'Opened your default Chrome profile. Install Vitt Page Capture once via Load unpacked on the Scrape tab if needed.'
    });

  if (platform === 'darwin') {
    const app = findMacChromeApp();
    if (!app) {
      return Promise.reject(new Error('Google Chrome was not found on this Mac.'));
    }
    const args = url ? ['-a', app.label, url] : ['-a', app.label];
    return spawnDetached('open', args).then((info) => finish({ ...info, binary: app.binary }));
  }

  const chromePath = findChromeExecutable();
  if (!chromePath) {
    return Promise.reject(
      new Error('Google Chrome or Chromium was not found. Set VITT_CHROME_PATH to your chrome executable.')
    );
  }

  // No --user-data-dir: uses the system default profile already on disk.
  const args = url ? [url] : [];
  return spawnDetached(chromePath, args).then((info) => finish({ ...info, command: chromePath }));
}

export function getScrapeServerDefaults() {
  return {
    httpBase: process.env.VITT_PORT ? `http://127.0.0.1:${process.env.VITT_PORT}` : 'http://127.0.0.1:5000',
    wsUrl: process.env.VITT_PORT ? `ws://127.0.0.1:${process.env.VITT_PORT}/ws` : 'ws://127.0.0.1:5000/ws',
    bridgeUrl: process.env.VITT_EXTENSION_BRIDGE_WS_PORT
      ? `ws://127.0.0.1:${process.env.VITT_EXTENSION_BRIDGE_WS_PORT}`
      : 'ws://127.0.0.1:38772'
  };
}
